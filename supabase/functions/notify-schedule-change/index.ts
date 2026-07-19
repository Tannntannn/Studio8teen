import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AffectedBooking = {
  id: string;
  clientId: string;
  clientEmail?: string;
  clientName?: string;
  packageName?: string;
  date?: string;
  time?: string;
  action?: "cancelled" | "rescheduled" | "affected";
};

async function sendResendEmail(payload: {
  to: string;
  clientName: string;
  packageName: string;
  bookingDate: string;
  reason: string;
  bookingUrl: string;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "Studio 8Teen <onboarding@resend.dev>";
  if (!resendKey || !payload.to) return { skipped: true, channel: "email" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: payload.to,
      subject: `Important update about your booking on ${payload.bookingDate}`,
      html: `
        <p>Hi ${payload.clientName || "there"},</p>
        <p>We want to let you know that your <strong>${payload.packageName || "photography"}</strong>
        session scheduled for <strong>${payload.bookingDate}</strong> has been affected.</p>
        <p><strong>Reason:</strong> ${payload.reason}</p>
        <p><a href="${payload.bookingUrl}" style="display:inline-block;padding:12px 20px;background:#A98B75;color:#ffffff;text-decoration:none;border-radius:8px;">
          View booking
        </a></p>
        <p>Please log in to your account for updates, or contact us if you have questions.</p>
        <p>We apologize for the inconvenience.<br/>Studio 8Teen</p>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Resend failed: ${detail}`);
  }
  return { ok: true, channel: "email" };
}

async function sendOneSignalPush(payload: {
  externalUserId: string;
  title: string;
  message: string;
  bookingUrl: string;
}) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_API_KEY");
  if (!appId || !apiKey || !payload.externalUserId) {
    return { skipped: true, channel: "push" };
  }

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_aliases: { external_id: [payload.externalUserId] },
      target_channel: "push",
      headings: { en: payload.title },
      contents: { en: payload.message },
      url: payload.bookingUrl,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`OneSignal failed: ${detail}`);
  }
  return { ok: true, channel: "push" };
}

function actionPhrase(action?: string) {
  if (action === "cancelled") return "cancelled";
  if (action === "rescheduled") return "rescheduled";
  return "affected by a schedule change";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Prefer caller JWT for admin check; fall back to service role body
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await anon.auth.getUser();
    if (!userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return jsonResponse({ error: "Admin only" }, 403);
    }

    const body = await req.json();
    const reason = String(body?.reason || "Your booking schedule was updated.");
    const skipInApp = Boolean(body?.skipInApp);
    const incoming = Array.isArray(body?.bookings) ? body.bookings : [];
    const appUrl = (Deno.env.get("APP_URL") || body?.appUrl || "https://www.studio8teen.org").replace(/\/$/, "");

    const ids = [...new Set(incoming.map((b: AffectedBooking) => b?.id).filter(Boolean))] as string[];
    if (!ids.length) return jsonResponse({ ok: true, notified: 0 });

    const { data: rows, error: loadError } = await supabase
      .from("bookings")
      .select("id, client_id, event_date, time_slot, packages(name), profiles:client_id(full_name, email)")
      .in("id", ids);
    if (loadError) throw loadError;

    const actionById = Object.fromEntries(
      incoming.map((b: AffectedBooking) => [b.id, b.action || "affected"])
    );

    const bookings: AffectedBooking[] = (rows || []).map((r) => ({
      id: r.id,
      clientId: r.client_id,
      clientEmail: (r.profiles as { email?: string } | null)?.email || "",
      clientName: (r.profiles as { full_name?: string } | null)?.full_name || "there",
      packageName: (r.packages as { name?: string } | null)?.name || "photography",
      date: r.event_date,
      time: r.time_slot,
      action: actionById[r.id] || "affected",
    }));

    if (!bookings.length) return jsonResponse({ ok: true, notified: 0 });

    const results = await Promise.allSettled(
      bookings.map(async (booking) => {
        const when = [booking.date, booking.time].filter(Boolean).join(" at ") || "your scheduled date";
        const phrase = actionPhrase(booking.action);
        const title = "Your booking has been affected";
        const message =
          `Your ${booking.packageName || "photography"} session on ${when} has been ${phrase}. ` +
          `Please check your bookings for updates. Reason: ${reason}`;
        const link = `/client-bookings/${booking.id}`;
        const bookingUrl = `${appUrl}${link}`;

        const tasks: Promise<unknown>[] = [];
        const channelNames: string[] = [];

        if (!skipInApp) {
          channelNames.push("in_app");
          tasks.push(
            supabase.from("notifications").insert({
              user_id: booking.clientId,
              type: "booking",
              title,
              message,
              link,
              booking_id: booking.id,
              is_read: false,
            })
          );
        }

        channelNames.push("email", "push");
        tasks.push(
          sendResendEmail({
            to: booking.clientEmail || "",
            clientName: booking.clientName || "there",
            packageName: booking.packageName || "photography",
            bookingDate: when,
            reason,
            bookingUrl,
          }),
          sendOneSignalPush({
            externalUserId: booking.clientId,
            title: "Booking Update",
            message,
            bookingUrl,
          })
        );

        const channelResults = await Promise.allSettled(tasks);

        return {
          bookingId: booking.id,
          channels: channelResults.map((r, i) => ({
            channel: channelNames[i],
            status: r.status,
            error: r.status === "rejected" ? String((r as PromiseRejectedResult).reason) : null,
          })),
        };
      })
    );

    return jsonResponse({
      ok: true,
      notified: results.filter((r) => r.status === "fulfilled").length,
      results,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ ok: false, error: (e as Error).message }, 500);
  }
});
