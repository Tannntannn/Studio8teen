import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function paymongoAuth(secret: string) {
  return `Basic ${btoa(`${secret}:`)}`;
}

async function paymongo(secret: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.paymongo.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: paymongoAuth(secret),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.detail ||
      json?.errors?.[0]?.code ||
      `PayMongo error (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

export async function applyPaidCheckout(
  admin: ReturnType<typeof createClient>,
  paymentRow: {
    id: string;
    booking_id: string;
    status: string;
  },
  checkoutId: string,
  paymongoPaymentId: string | null
) {
  if (paymentRow.status !== "verified") {
    const { error: pErr } = await admin
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
  if (pErr) throw pErr;
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, qr_token")
    .eq("id", paymentRow.booking_id)
    .maybeSingle();

  if (booking && !["pending", "confirmed", "completed", "cancelled"].includes(booking.status)) {
    const { error: bErr } = await admin
      .from("bookings")
      .update({
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", paymentRow.booking_id);
    if (bErr) throw bErr;
  }

  return { ok: true, already: paymentRow.status === "verified" };
}

const RESERVATION_FEE = 150;
const CANCELLATION_FEE = 100;

async function applyCancellationPaid(
  admin: ReturnType<typeof createClient>,
  cancellationId: string,
  bookingId: string,
  checkoutId: string
) {
  const { error } = await admin
    .from("cancellations")
    .update({
      fee_status: "submitted",
      paymongo_checkout_id: checkoutId,
    })
    .eq("id", cancellationId);
  if (error) throw error;

  await admin
    .from("bookings")
    .update({
      status: "cancellation_submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)
    .eq("status", "cancellation_pending");

  return { ok: true, paid: true, purpose: "cancellation" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const paymongoSecret = Deno.env.get("PAYMONGO_SECRET_KEY") ?? "";

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }
    if (!paymongoSecret) {
      return jsonResponse(
        { error: "Online checkout is not configured yet. Please contact the studio." },
        500
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.booking_id || "");
    const paymentType = body?.payment_type === "full" ? "full" : "downpayment";
    const purpose = body?.purpose === "cancellation" ? "cancellation" : "booking";
    const origin = String(body?.origin || "").replace(/\/$/, "");
    const syncOnly = Boolean(body?.sync);

    if (!bookingId) return jsonResponse({ error: "booking_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, client_id, status, addons_total, packages(name, price)")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) return jsonResponse({ error: "Booking not found" }, 404);
    if (booking.client_id !== user.id) {
      return jsonResponse({ error: "This booking is not yours." }, 403);
    }
    if (["cancelled", "completed"].includes(booking.status)) {
      return jsonResponse({ error: "This booking cannot be paid." }, 400);
    }

    if (purpose === "cancellation") {
      if (!["cancellation_pending", "cancellation_submitted"].includes(booking.status)) {
        return jsonResponse({ error: "This booking is not waiting for a cancellation fee." }, 400);
      }
      const { data: cancellation } = await admin
        .from("cancellations")
        .select("id, fee_status, paymongo_checkout_id")
        .eq("booking_id", bookingId)
        .order("cancelled_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancellation) return jsonResponse({ error: "Cancellation request not found." }, 404);
      if (cancellation.fee_status === "verified") {
        return jsonResponse({ ok: true, already_paid: true, purpose: "cancellation" });
      }

      if (syncOnly) {
        const checkoutId = cancellation.paymongo_checkout_id;
        if (!checkoutId) return jsonResponse({ ok: false, pending: true });
        const session = await paymongo(paymongoSecret, `checkout_sessions/${checkoutId}`);
        const attrs = session?.data?.attributes || {};
        const paid =
          attrs.payment_intent?.attributes?.status === "succeeded" ||
          attrs.status === "paid" ||
          (Array.isArray(attrs.payments) && attrs.payments.length > 0);
        if (!paid) return jsonResponse({ ok: false, pending: true, checkout_status: attrs.status });
        if (cancellation.fee_status !== "submitted") {
          await applyCancellationPaid(admin, cancellation.id, bookingId, checkoutId);
        }
        return jsonResponse({ ok: true, paid: true, purpose: "cancellation" });
      }

      if (!origin.startsWith("http")) {
        return jsonResponse({ error: "origin (https site URL) is required." }, 400);
      }

      const feeCentavos = CANCELLATION_FEE * 100;
      const successUrl = `${origin}/client-bookings/${bookingId}?paymongo=success&fee=cancellation`;
      const cancelUrl = `${origin}/client-bookings/${bookingId}?paymongo=cancelled&fee=cancellation`;
      const pkgName = booking.packages?.name || "Studio session";
      const session = await paymongo(paymongoSecret, "checkout_sessions", {
        method: "POST",
        body: JSON.stringify({
          data: {
            attributes: {
              send_email_receipt: false,
              show_description: true,
              show_line_items: true,
              description: `Studio 8Teen · ${pkgName} · Cancellation fee`,
              line_items: [
                {
                  currency: "PHP",
                  amount: feeCentavos,
                  name: "Cancellation fee",
                  quantity: 1,
                },
              ],
              payment_method_types: ["card", "gcash", "paymaya"],
              success_url: successUrl,
              cancel_url: cancelUrl,
              metadata: {
                booking_id: bookingId,
                cancellation_id: cancellation.id,
                purpose: "cancellation",
              },
            },
          },
        }),
      });
      const checkoutId = session?.data?.id;
      const checkoutUrl = session?.data?.attributes?.checkout_url;
      if (!checkoutId || !checkoutUrl) {
        return jsonResponse({ error: "PayMongo did not return a checkout URL." }, 502);
      }
      const { error: saveErr } = await admin
        .from("cancellations")
        .update({ paymongo_checkout_id: checkoutId })
        .eq("id", cancellation.id);
      if (saveErr) throw saveErr;
      return jsonResponse({
        ok: true,
        checkout_url: checkoutUrl,
        checkout_id: checkoutId,
        amount: CANCELLATION_FEE,
        purpose: "cancellation",
      });
    }

    const { data: existing } = await admin
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.status === "verified") {
      await applyPaidCheckout(
        admin,
        existing,
        existing.paymongo_checkout_id || "",
        existing.paymongo_payment_id || null
      );
      return jsonResponse({ ok: true, already_paid: true });
    }

    if (syncOnly) {
      const checkoutId = existing?.paymongo_checkout_id;
      if (!checkoutId) return jsonResponse({ ok: false, pending: true });
      const session = await paymongo(paymongoSecret, `checkout_sessions/${checkoutId}`);
      const attrs = session?.data?.attributes || {};
      const paid =
        attrs.payment_intent?.attributes?.status === "succeeded" ||
        attrs.status === "paid" ||
        (Array.isArray(attrs.payments) && attrs.payments.length > 0);
      if (!paid) return jsonResponse({ ok: false, pending: true, checkout_status: attrs.status });
      const payId = attrs.payments?.[0]?.id || attrs.payments?.[0]?.data?.id || null;
      await applyPaidCheckout(admin, existing, checkoutId, payId);
      return jsonResponse({ ok: true, paid: true });
    }

    const { data: settings } = await admin
      .from("studio_settings")
      .select("downpayment_percent")
      .eq("id", 1)
      .maybeSingle();

    const packagePrice = Number(booking.packages?.price || 0);
    const addonsTotal = Number(booking.addons_total || 0);
    const grandTotal = packagePrice + addonsTotal;
    const downPercent = Number(settings?.downpayment_percent || 50);
    const sessionAmount =
      paymentType === "full" ? grandTotal : Math.round((grandTotal * downPercent) / 100);
    const amount = sessionAmount + RESERVATION_FEE;
    const sessionCentavos = Math.round(sessionAmount * 100);
    const reservationCentavos = RESERVATION_FEE * 100;
    const amountCentavos = sessionCentavos + reservationCentavos;
    if (!Number.isFinite(amountCentavos) || amountCentavos < 2000) {
      return jsonResponse({ error: "Amount is too small for PayMongo (minimum ₱20)." }, 400);
    }

    if (!origin.startsWith("http")) {
      return jsonResponse({ error: "origin (https site URL) is required." }, 400);
    }

    const successUrl = `${origin}/client-bookings/${bookingId}?paymongo=success`;
    const cancelUrl = `${origin}/client-bookings/${bookingId}?paymongo=cancelled`;
    const pkgName = booking.packages?.name || "Studio session";
    const label = paymentType === "full" ? "Full payment" : "Downpayment";

    let paymentId = existing?.id;
    if (!paymentId) {
      const { data: created, error: cErr } = await admin
        .from("payments")
        .insert({
          booking_id: bookingId,
          payment_type: paymentType,
          amount,
          status: "awaiting",
          notes: "PayMongo checkout started",
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      paymentId = created.id;
    } else {
      await admin
        .from("payments")
        .update({
          payment_type: paymentType,
          amount,
          status: "awaiting",
          notes: "PayMongo checkout started",
        })
        .eq("id", paymentId);
    }

    const session = await paymongo(paymongoSecret, "checkout_sessions", {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            description: `Studio 8Teen · ${pkgName} · ${label}`,
            line_items: [
              ...(sessionCentavos > 0
                ? [
                    {
                      currency: "PHP",
                      amount: sessionCentavos,
                      name: `${label} — ${pkgName}`,
                      quantity: 1,
                    },
                  ]
                : []),
              {
                currency: "PHP",
                amount: reservationCentavos,
                name: "Reservation fee",
                quantity: 1,
              },
            ],
            payment_method_types: ["card", "gcash", "paymaya"],
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
              booking_id: bookingId,
              payment_id: paymentId,
              payment_type: paymentType,
            },
          },
        },
      }),
    });

    const checkoutId = session?.data?.id;
    const checkoutUrl = session?.data?.attributes?.checkout_url;
    if (!checkoutId || !checkoutUrl) {
      return jsonResponse({ error: "PayMongo did not return a checkout URL." }, 502);
    }

    await admin
      .from("payments")
      .update({ paymongo_checkout_id: checkoutId })
      .eq("id", paymentId);

    return jsonResponse({
      ok: true,
      checkout_url: checkoutUrl,
      checkout_id: checkoutId,
      amount,
    });
  } catch (err) {
    return jsonResponse({ error: err?.message || "PayMongo checkout failed." }, 500);
  }
});
