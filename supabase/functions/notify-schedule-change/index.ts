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

async function onesignalHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Key ${apiKey}`,
  };
}

/** Resolve live web-push subscription IDs for an external user id. */
async function resolveOneSignalSubscriptionIds(
  appId: string,
  apiKey: string,
  externalUserId: string,
  preferredId?: string
): Promise<string[]> {
  const ids = new Set<string>();
  if (preferredId) ids.add(String(preferredId));

  try {
    const res = await fetch(
      `https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(externalUserId)}`,
      { headers: await onesignalHeaders(apiKey) }
    );
    const text = await res.text();
    console.log("OneSignal lookup user:", res.status, text.slice(0, 800));
    if (res.ok) {
      const data = JSON.parse(text);
      const subs = data?.subscriptions || data?.user?.subscriptions || [];
      for (const sub of subs) {
        const type = String(sub?.type || sub?.device_type || "").toLowerCase();
        const enabled = sub?.enabled !== false && sub?.invalid_identifier !== true;
        const id = sub?.id || sub?.subscription_id;
        // ChromePush / FirefoxPush / SafariPush / etc.
        if (id && enabled && (type.includes("push") || type.includes("chrome") || type.includes("firefox") || type.includes("safari") || !type)) {
          ids.add(String(id));
        }
      }
    }
  } catch (err) {
    console.warn("OneSignal user lookup failed:", (err as Error).message);
  }

  return [...ids];
}

async function sendOneSignalPush(payload: {
  externalUserId: string;
  subscriptionId?: string;
  title: string;
  message: string;
  bookingUrl: string;
}) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const rawKey = Deno.env.get("ONESIGNAL_API_KEY") || "";
  const apiKey = rawKey.replace(/^(Key|Basic)\s+/i, "").trim();
  if (!appId || !apiKey || !payload.externalUserId) {
    console.warn("OneSignal skipped: missing appId/apiKey/externalUserId", {
      hasAppId: Boolean(appId),
      hasKey: Boolean(apiKey),
      externalUserId: payload.externalUserId,
    });
    return { skipped: true, channel: "push" };
  }

  const subscriptionIds = await resolveOneSignalSubscriptionIds(
    appId,
    apiKey,
    String(payload.externalUserId),
    payload.subscriptionId
  );

  const baseBody = {
    app_id: appId,
    target_channel: "push",
    headings: { en: payload.title },
    contents: { en: payload.message },
    url: payload.bookingUrl,
    web_url: payload.bookingUrl,
  };

  const attempts: { name: string; body: Record<string, unknown> }[] = [];

  if (subscriptionIds.length) {
    attempts.push({
      name: "include_subscription_ids",
      body: {
        ...baseBody,
        include_subscription_ids: subscriptionIds,
      },
    });
  }

  attempts.push(
    {
      name: "include_aliases",
      body: {
        ...baseBody,
        include_aliases: { external_id: [String(payload.externalUserId)] },
      },
    },
    {
      name: "include_external_user_ids",
      body: {
        ...baseBody,
        include_external_user_ids: [String(payload.externalUserId)],
      },
    }
  );

  let lastError = "";
  for (const attempt of attempts) {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: await onesignalHeaders(apiKey),
      body: JSON.stringify(attempt.body),
    });
    const detail = await res.text();
    console.log(`OneSignal ${attempt.name}:`, res.status, detail.slice(0, 800));

    if (!res.ok) {
      lastError = `${attempt.name} ${res.status}: ${detail}`;
      // Retry once with Basic auth for older keys
      if (res.status === 401 || res.status === 403) {
        const basicRes = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Authorization: `Basic ${apiKey}`,
          },
          body: JSON.stringify(attempt.body),
        });
        const basicDetail = await basicRes.text();
        console.log(`OneSignal ${attempt.name} Basic retry:`, basicRes.status, basicDetail.slice(0, 500));
        if (basicRes.ok) {
          try {
            const parsed = JSON.parse(basicDetail);
            if (Number(parsed?.recipients || 0) > 0) {
              return { ok: true, channel: "push", method: `${attempt.name}+Basic`, recipients: parsed.recipients, id: parsed.id };
            }
          } catch {
            /* continue */
          }
        }
      }
      continue;
    }

    try {
      const parsed = JSON.parse(detail);
      if (parsed?.errors?.length) {
        lastError = `${attempt.name} errors: ${JSON.stringify(parsed.errors)}`;
        continue;
      }
      const recipients = Number(parsed?.recipients ?? 0);
      if (recipients > 0) {
        return { ok: true, channel: "push", method: attempt.name, recipients, id: parsed.id, subscriptionIds };
      }
      lastError = `${attempt.name} returned 0 recipients; ids=${JSON.stringify(subscriptionIds)}`;
    } catch {
      return { ok: true, channel: "push", method: attempt.name, raw: detail };
    }
  }

  throw new Error(`OneSignal failed for ${payload.externalUserId}: ${lastError}`);
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
      .select("id, client_id, event_date, time_slot, packages(name)")
      .in("id", ids);
    if (loadError) throw loadError;

    const clientIds = [...new Set((rows || []).map((r) => r.client_id).filter(Boolean))];
    let profilesById: Record<string, { full_name?: string; email?: string; onesignal_subscription_id?: string }> = {};
    if (clientIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, onesignal_subscription_id")
        .in("id", clientIds);
      if (profileError) console.warn("profile load:", profileError.message);
      profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const actionById = Object.fromEntries(
      incoming.map((b: AffectedBooking) => [b.id, b.action || "affected"])
    );

    const bookings = (rows || []).map((r) => {
      const profile = profilesById[r.client_id] || {};
      return {
        id: r.id,
        clientId: r.client_id,
        clientEmail: profile.email || "",
        clientName: profile.full_name || "there",
        packageName: (r.packages as { name?: string } | null)?.name || "photography",
        date: r.event_date,
        time: r.time_slot,
        action: actionById[r.id] || "affected",
        subscriptionId: profile.onesignal_subscription_id || "",
      };
    });

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
            subscriptionId: booking.subscriptionId,
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
