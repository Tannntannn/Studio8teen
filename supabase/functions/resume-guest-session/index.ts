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

const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, limit = 8, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const row = rateMap.get(key);
  if (!row || now > row.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  row.count += 1;
  return row.count > limit;
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function digitsOnly(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const tail = (s: string) => (s.length >= 10 ? s.slice(-10) : s);
  return tail(da) === tail(db);
}

function randomPassword(length = 32): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

const OPEN_STATUSES = [
  "awaiting_payment",
  "payment_submitted",
  "confirmed",
  "cancellation_pending",
  "cancellation_submitted",
];

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_guest: boolean | null;
  claimed_at: string | null;
  guest_archived_at: string | null;
  guest_expires_at: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const email = normalizeEmail(body?.email);
    const phone = String(body?.phone || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "A valid email is required." }, 400);
    }
    if (digitsOnly(phone).length < 7) {
      return jsonResponse({ error: "A valid phone number is required." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(`ip:${ip}`, 12) || rateLimited(`email:${email}`, 6)) {
      return jsonResponse(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        429,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

  const { data: openBookings, error: bErr } = await admin
      .from("bookings")
      .select("id, client_id, status, contact_number, guest_snapshot")
      .in("status", OPEN_STATUSES)
      .order("created_at", { ascending: false })
      .limit(120);

    if (bErr) {
      console.error(bErr);
      return jsonResponse({ error: "Could not look up walk-in bookings." }, 500);
    }

    const clientIds = [
      ...new Set((openBookings || []).map((b) => b.client_id).filter(Boolean)),
    ] as string[];

    let profiles: ProfileRow[] = [];
    if (clientIds.length) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select(
          "id, full_name, email, phone, is_guest, claimed_at, guest_archived_at, guest_expires_at",
        )
        .in("id", clientIds)
        .eq("is_guest", true)
        .is("claimed_at", null)
        .is("guest_archived_at", null);
      if (pErr) {
        console.error(pErr);
        return jsonResponse({ error: "Could not look up walk-in session." }, 500);
      }
      profiles = (profs || []) as ProfileRow[];
    }

    // Also include guests whose contact email is on the profile (may have no open booking yet)
    const { data: emailProfiles } = await admin
      .from("profiles")
      .select(
        "id, full_name, email, phone, is_guest, claimed_at, guest_archived_at, guest_expires_at",
      )
      .eq("is_guest", true)
      .is("claimed_at", null)
      .is("guest_archived_at", null)
      .ilike("email", email);

    const profileMap = new Map<string, ProfileRow>();
    for (const p of profiles) profileMap.set(p.id, p);
    for (const p of (emailProfiles || []) as ProfileRow[]) profileMap.set(p.id, p);

    const matchedIds: string[] = [];

    for (const b of openBookings || []) {
      const prof = b.client_id ? profileMap.get(b.client_id) : null;
      if (!prof) continue;

      const snap = (b.guest_snapshot || {}) as { email?: string; phone?: string };
      const emails = [
        normalizeEmail(prof.email || ""),
        normalizeEmail(snap.email || ""),
      ].filter(Boolean);
      const phones = [prof.phone || "", snap.phone || "", b.contact_number || ""].filter(
        Boolean,
      );

      const emailOk = emails.includes(email);
      const phoneOk = phones.some((ph) => phonesMatch(ph, phone));
      if (emailOk && phoneOk) matchedIds.push(prof.id);
    }

    // Profile-only match (contact saved, booking open checked below)
    for (const p of profileMap.values()) {
      if (normalizeEmail(p.email || "") !== email) continue;
      if (!phonesMatch(p.phone || "", phone)) continue;
      matchedIds.push(p.id);
    }

    const uniqueIds = [...new Set(matchedIds)];
    if (!uniqueIds.length) {
      return jsonResponse(
        {
          error:
            "No open walk-in found for that email and phone. Check the details from your booking, or start a new Quick Session.",
        },
        404,
      );
    }

    let matched: ProfileRow | null = null;
    const now = Date.now();
    for (const id of uniqueIds) {
      const cand = profileMap.get(id);
      if (!cand) continue;
      if (cand.guest_expires_at && new Date(cand.guest_expires_at).getTime() < now) {
        continue; // login window ended — booking records remain for the studio
      }
      const { data: open } = await admin
        .from("bookings")
        .select("id")
        .eq("client_id", id)
        .in("status", OPEN_STATUSES)
        .limit(1);
      if (open?.length) {
        matched = cand;
        break;
      }
    }

    if (!matched) {
      // Distinguish expired vs not found
      const anyExpired = uniqueIds.some((id) => {
        const cand = profileMap.get(id);
        return cand?.guest_expires_at && new Date(cand.guest_expires_at).getTime() < now;
      });
      if (anyExpired) {
        return jsonResponse(
          {
            error:
              "This guest login has expired (about 2 days). Your booking and payment stay with the studio — contact them if you need help. Or create a new Quick Session / full account.",
          },
          410,
        );
      }
      return jsonResponse(
        {
          error:
            "That walk-in session has no open bookings left. Start a new Quick Session if you need to book again.",
        },
        404,
      );
    }

    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
      matched.id,
    );
    if (authErr || !authUser?.user?.email) {
      console.error(authErr);
      return jsonResponse({ error: "Guest login could not be restored." }, 500);
    }

    const password = randomPassword();
    const { error: updErr } = await admin.auth.admin.updateUserById(matched.id, {
      password,
      ban_duration: "none",
      email_confirm: true,
      user_metadata: {
        ...(authUser.user.user_metadata || {}),
        is_guest: true,
        archived: false,
      },
    });
    if (updErr) {
      console.error(updErr);
      return jsonResponse({ error: "Could not restore guest session." }, 500);
    }

    await admin
      .from("profiles")
      .update({
        guest_archived_at: null,
        is_guest: true,
      })
      .eq("id", matched.id);

    const { data: sessionData, error: signInErr } = await admin.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });

    if (signInErr || !sessionData?.session) {
      console.error(signInErr);
      return jsonResponse({ error: "Sign-in failed. Try again." }, 500);
    }

    return jsonResponse({
      ok: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      user: {
        id: matched.id,
        email: matched.email,
        full_name: matched.full_name,
        is_guest: true,
        guest_expires_at: matched.guest_expires_at,
      },
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Unexpected error resuming walk-in." }, 500);
  }
});
