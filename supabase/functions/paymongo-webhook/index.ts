import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, paymongo-signature",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return hex(sig);
}

function parseSignature(header: string) {
  const parts = Object.fromEntries(
    String(header || "")
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((kv) => kv.length === 2)
  );
  return {
    t: parts.t || "",
    te: parts.te || "",
    li: parts.li || "",
  };
}

async function applyPaid(
  admin: ReturnType<typeof createClient>,
  paymentRow: { id: string; booking_id: string; status: string },
  checkoutId: string,
  paymongoPaymentId: string | null
) {
  if (paymentRow.status !== "verified") {
    await admin
      .from("payments")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
        paymongo_checkout_id: checkoutId,
        paymongo_payment_id: paymongoPaymentId,
        notes: "Paid via PayMongo",
        rejection_note: null,
      })
      .eq("id", paymentRow.id);
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status")
    .eq("id", paymentRow.booking_id)
    .maybeSingle();

  if (booking && !["pending", "confirmed", "completed", "cancelled"].includes(booking.status)) {
    await admin
      .from("bookings")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.booking_id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET") ?? "";
    const sigHeader = req.headers.get("Paymongo-Signature") || req.headers.get("paymongo-signature") || "";

    if (webhookSecret) {
      const { t, te, li } = parseSignature(sigHeader);
      const expected = await hmacSha256(webhookSecret, `${t}.${rawBody}`);
      const given = te || li;
      if (!t || !given || given !== expected) {
        return jsonResponse({ error: "Invalid PayMongo signature." }, 401);
      }
    }

    const event = JSON.parse(rawBody || "{}");
    const type = event?.data?.attributes?.type || event?.type;
    const paidTypes = new Set([
      "checkout_session.payment.paid",
      "payment.paid",
      "link.payment.paid",
    ]);
    if (!paidTypes.has(type)) {
      return jsonResponse({ ok: true, ignored: type || "unknown" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const resource = event?.data?.attributes?.data || event?.data;
    const checkoutId =
      resource?.id?.startsWith?.("cs_")
        ? resource.id
        : resource?.attributes?.checkout_session_id ||
          resource?.attributes?.metadata?.checkout_id ||
          null;
    const metadata = resource?.attributes?.metadata || {};
    if (metadata.purpose === "cancellation") {
      const cancellationId = metadata.cancellation_id || null;
      const cancelBookingId = metadata.booking_id || null;
      if (!cancellationId) return jsonResponse({ ok: false, error: "cancellation_not_found" }, 404);
      await admin
        .from("cancellations")
        .update({
          fee_status: "submitted",
          ...(checkoutId ? { paymongo_checkout_id: checkoutId } : {}),
        })
        .eq("id", cancellationId);
      if (cancelBookingId) {
        await admin
          .from("bookings")
          .update({
            status: "cancellation_submitted",
            updated_at: new Date().toISOString(),
          })
          .eq("id", cancelBookingId)
          .eq("status", "cancellation_pending");
      }
      return jsonResponse({ ok: true, purpose: "cancellation" });
    }
    const paymentUuid = metadata.payment_id || null;
    const bookingId = metadata.booking_id || null;
    const nestedPay = resource?.attributes?.payments?.[0]?.id;
    const paymongoPaymentId =
      nestedPay || (resource?.id?.startsWith?.("pay_") ? resource.id : null);

    let paymentRow = null;
    if (paymentUuid) {
      const { data } = await admin.from("payments").select("*").eq("id", paymentUuid).maybeSingle();
      paymentRow = data;
    }
    if (!paymentRow && checkoutId) {
      const { data } = await admin
        .from("payments")
        .select("*")
        .eq("paymongo_checkout_id", checkoutId)
        .maybeSingle();
      paymentRow = data;
    }
    if (!paymentRow && bookingId) {
      const { data } = await admin
        .from("payments")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      paymentRow = data;
    }

    if (!paymentRow) {
      return jsonResponse({ ok: false, error: "payment_not_found" }, 404);
    }

    await applyPaid(admin, paymentRow, checkoutId || paymentRow.paymongo_checkout_id, paymongoPaymentId);
    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err?.message || "Webhook failed." }, 500);
  }
});
