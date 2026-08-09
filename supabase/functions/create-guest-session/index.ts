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

function randomPassword(length = 32): string {
  const alphabet =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const fullName = String(body?.full_name || "").trim();
    const phone = String(body?.phone || "").trim();
    const email = normalizeEmail(body?.email);

    if (!fullName || fullName.length < 2) {
      return jsonResponse({ error: "Full name is required." }, 400);
    }
    if (!phone || phone.length < 7) {
      return jsonResponse({ error: "A valid phone number is required." }, 400);
    }
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: "A valid email is required." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(`email:${email}`) || rateLimited(`ip:${ip}`)) {
      return jsonResponse({ error: "Too many requests. Please wait a few minutes and try again." }, 429);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email, is_guest, guest_expires_at, claimed_at, role")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile && existingProfile.role === "admin") {
      return jsonResponse({ error: "This email cannot be used for a quick session." }, 400);
    }

    if (existingProfile && !existingProfile.is_guest) {
      return jsonResponse({
        error: "An account already exists for this email. Please log in instead.",
        code: "account_exists",
      }, 409);
    }

    if (
      existingProfile?.is_guest &&
      !existingProfile.claimed_at &&
      existingProfile.guest_expires_at &&
      new Date(existingProfile.guest_expires_at).getTime() < Date.now()
    ) {
      const { error: deleteErr } = await admin.auth.admin.deleteUser(existingProfile.id);
      if (deleteErr) {
        console.error("Failed deleting expired guest:", deleteErr);
        return jsonResponse({ error: "Could not recycle expired guest session. Try again." }, 500);
      }
    }

    const password = randomPassword();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let userId = existingProfile?.id as string | undefined;

    if (existingProfile?.is_guest && !existingProfile.claimed_at) {
      // Resume active guest: rotate password and refresh expiry
      const { error: updateAuthErr } = await admin.auth.admin.updateUserById(existingProfile.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "client", is_guest: true },
      });
      if (updateAuthErr) {
        console.error(updateAuthErr);
        return jsonResponse({ error: "Could not resume guest session." }, 500);
      }
      userId = existingProfile.id;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "client", is_guest: true },
      });
      if (createErr || !created?.user) {
        console.error(createErr);
        const msg = createErr?.message?.toLowerCase().includes("already")
          ? "An account already exists for this email. Please log in instead."
          : createErr?.message || "Could not create guest session.";
        return jsonResponse({ error: msg }, 400);
      }
      userId = created.user.id;
    }

    const { error: profileErr } = await admin.from("profiles").update({
      full_name: fullName,
      phone,
      email,
      is_guest: true,
      guest_expires_at: expiresAt,
      claimed_at: null,
    }).eq("id", userId);

    if (profileErr) {
      console.error(profileErr);
      return jsonResponse({ error: "Guest profile could not be saved." }, 500);
    }

    const { data: sessionData, error: signInErr } = await admin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !sessionData?.session) {
      console.error(signInErr);
      return jsonResponse({ error: "Guest created but sign-in failed. Try logging in later." }, 500);
    }

    return jsonResponse({
      ok: true,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at,
      user: {
        id: userId,
        email,
        full_name: fullName,
        is_guest: true,
        guest_expires_at: expiresAt,
      },
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Unexpected error creating guest session." }, 500);
  }
});
