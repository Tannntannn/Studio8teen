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

function authHeaders(apiKey: string, mode: "Key" | "Basic" = "Key") {
  return {
    "Content-Type": "application/json; charset=utf-8",
    Authorization: mode === "Key" ? `Key ${apiKey}` : `Basic ${apiKey}`,
  };
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, text, json };
}

/** Pull every subscription id for this external user from OneSignal. */
async function resolveSubscriptionIds(
  appId: string,
  apiKey: string,
  externalUserId: string,
  preferredId?: string
) {
  const ids = new Set<string>();
  if (preferredId) ids.add(String(preferredId).trim());

  const urls = [
    `https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(externalUserId)}`,
    `https://onesignal.com/api/v1/apps/${appId}/users/by/external_id/${encodeURIComponent(externalUserId)}`,
  ];

  for (const mode of ["Key", "Basic"] as const) {
    for (const url of urls) {
      try {
        const { res, text, json } = await fetchJson(url, { headers: authHeaders(apiKey, mode) });
        console.log("OneSignal user lookup:", mode, res.status, text.slice(0, 1000));
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            `OneSignal auth failed (${res.status}). Update ONESIGNAL_API_KEY in Supabase secrets with the REST API Key from OneSignal → Settings → Keys & IDs.`
          );
        }
        if (!res.ok || !json) continue;

        const root = (json.user as Record<string, unknown>) || json;
        const subs = (root.subscriptions as unknown[]) || (json.subscriptions as unknown[]) || [];
        for (const raw of subs) {
          const sub = raw as Record<string, unknown>;
          const id = String(sub.id || sub.subscription_id || "").trim();
          // Prefer currently enabled push subscriptions
          const enabled = sub.enabled !== false;
          if (id && enabled) ids.add(id);
        }
        if (ids.size) return { ids: [...ids], lookupOk: true };
      } catch (err) {
        if ((err as Error).message?.includes("OneSignal auth failed")) throw err;
        console.warn("lookup error:", (err as Error).message);
      }
    }
  }

  return { ids: [...ids], lookupOk: false };
}

async function postNotification(
  apiKey: string,
  body: Record<string, unknown>
) {
  const endpoints = [
    "https://api.onesignal.com/notifications",
    "https://onesignal.com/api/v1/notifications",
  ];

  let lastDetail = "";
  for (const mode of ["Key", "Basic"] as const) {
    for (const endpoint of endpoints) {
      const { res, text, json } = await fetchJson(endpoint, {
        method: "POST",
        headers: authHeaders(apiKey, mode),
        body: JSON.stringify(body),
      });
      console.log("OneSignal send:", mode, endpoint, res.status, text.slice(0, 800));
      lastDetail = `${mode} ${res.status}: ${text.slice(0, 200)}`;
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `OneSignal auth failed (${res.status}). Update ONESIGNAL_API_KEY in Supabase secrets with the REST API Key from OneSignal → Settings → Keys & IDs.`
        );
      }
      if (!res.ok) continue;
      const recipients = Number((json as { recipients?: number } | null)?.recipients ?? 0);
      const errors = (json as { errors?: unknown } | null)?.errors;
      if (errors) {
        lastDetail = JSON.stringify(errors);
        continue;
      }
      if (recipients > 0) {
        return { ok: true, recipients, id: (json as { id?: string })?.id, mode, endpoint, body };
      }
    }
  }
  return { ok: false, recipients: 0, lastDetail };
}

async function sendOneSignalPush(payload: {
  externalUserId: string;
  subscriptionId?: string;
  title: string;
  message: string;
  bookingUrl: string;
}) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID") || "";
  const apiKey = (Deno.env.get("ONESIGNAL_API_KEY") || "").replace(/^(Key|Basic)\s+/i, "").trim();
  if (!appId || !apiKey || !payload.externalUserId) {
    return {
      skipped: true,
      channel: "push",
      reason: `missing config appId=${Boolean(appId)} key=${Boolean(apiKey)} user=${payload.externalUserId}`,
    };
  }

  const resolved = await resolveSubscriptionIds(
    appId,
    apiKey,
    String(payload.externalUserId),
    payload.subscriptionId
  );
  const subscriptionIds = resolved.ids;

  console.log("OneSignal targeting:", {
    appId,
    externalUserId: payload.externalUserId,
    subscriptionIds,
    lookupOk: resolved.lookupOk,
  });

  const content = {
    app_id: appId,
    headings: { en: payload.title },
    contents: { en: payload.message },
    url: payload.bookingUrl,
    web_url: payload.bookingUrl,
  };

  // 1) Prefer exact subscription ids (same as dashboard test device)
  if (subscriptionIds.length) {
    const batch = await postNotification(apiKey, {
      ...content,
      include_subscription_ids: subscriptionIds,
    });
    if (batch.ok) {
      return { ok: true, channel: "push", method: "include_subscription_ids", ...batch, subscriptionIds };
    }

    // Try one-by-one (dashboard-style)
    for (const sid of subscriptionIds) {
      const single = await postNotification(apiKey, {
        ...content,
        include_subscription_ids: [sid],
      });
      if (single.ok) {
        return {
          ok: true,
          channel: "push",
          method: "include_subscription_ids_single",
          subscriptionId: sid,
          ...single,
        };
      }

      // Legacy player id field
      const legacy = await postNotification(apiKey, {
        ...content,
        include_player_ids: [sid],
      });
      if (legacy.ok) {
        return {
          ok: true,
          channel: "push",
          method: "include_player_ids",
          subscriptionId: sid,
          ...legacy,
        };
      }
    }
  }

  // 2) External ID aliases
  const alias = await postNotification(apiKey, {
    ...content,
    target_channel: "push",
    include_aliases: { external_id: [String(payload.externalUserId)] },
  });
  if (alias.ok) {
    return { ok: true, channel: "push", method: "include_aliases", ...alias };
  }

  const external = await postNotification(apiKey, {
    ...content,
    include_external_user_ids: [String(payload.externalUserId)],
    channel_for_external_user_ids: "push",
  });
  if (external.ok) {
    return { ok: true, channel: "push", method: "include_external_user_ids", ...external };
  }

  throw new Error(
    `OneSignal 0 recipients for external_id=${payload.externalUserId} ` +
      `subscriptionIds=${JSON.stringify(subscriptionIds)} lookupOk=${resolved.lookupOk}. ` +
      `Copy the REST API Key from OneSignal → Settings → Keys & IDs and run: ` +
      `supabase secrets set ONESIGNAL_API_KEY=YOUR_REST_API_KEY`
  );
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

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await anon.auth.getUser();
    if (!userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin only" }, 403);

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
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, onesignal_subscription_id")
        .in("id", clientIds);
      profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
    }

    const actionById = Object.fromEntries(
      incoming.map((b: AffectedBooking) => [b.id, b.action || "affected"])
    );

    const bookings = (rows || []).map((r) => {
      const p = profilesById[r.client_id] || {};
      return {
        id: r.id,
        clientId: r.client_id,
        clientEmail: p.email || "",
        clientName: p.full_name || "there",
        packageName: (r.packages as { name?: string } | null)?.name || "photography",
        date: r.event_date,
        time: r.time_slot,
        action: actionById[r.id] || "affected",
        subscriptionId: p.onesignal_subscription_id || "",
      };
    });

    const results = await Promise.all(
      bookings.map(async (booking) => {
        const when = [booking.date, booking.time].filter(Boolean).join(" at ") || "your scheduled date";
        const phrase = actionPhrase(booking.action);
        const title = "Your booking has been affected";
        const message =
          `Your ${booking.packageName || "photography"} session on ${when} has been ${phrase}. ` +
          `Please check your bookings for updates. Reason: ${reason}`;
        const link = `/client-bookings/${booking.id}`;
        const bookingUrl = `${appUrl}${link}`;

        const channelResults: Record<string, unknown> = {};

        if (!skipInApp) {
          const { error } = await supabase.from("notifications").insert({
            user_id: booking.clientId,
            type: "booking",
            title,
            message,
            link,
            booking_id: booking.id,
            is_read: false,
          });
          channelResults.in_app = error ? { ok: false, error: error.message } : { ok: true };
        }

        try {
          channelResults.email = await sendResendEmail({
            to: booking.clientEmail || "",
            clientName: booking.clientName || "there",
            packageName: booking.packageName || "photography",
            bookingDate: when,
            reason,
            bookingUrl,
          });
        } catch (e) {
          channelResults.email = { ok: false, error: (e as Error).message };
        }

        try {
          channelResults.push = await sendOneSignalPush({
            externalUserId: booking.clientId,
            subscriptionId: booking.subscriptionId,
            title: "Booking Update",
            message,
            bookingUrl,
          });
        } catch (e) {
          channelResults.push = { ok: false, error: (e as Error).message };
        }

        return { bookingId: booking.id, clientId: booking.clientId, channels: channelResults };
      })
    );

    return jsonResponse({ ok: true, notified: results.length, results });
  } catch (e) {
    console.error(e);
    return jsonResponse({ ok: false, error: (e as Error).message }, 500);
  }
});
