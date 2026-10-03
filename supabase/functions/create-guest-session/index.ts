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

function slugifyName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24) || "guest";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const fullName = String(body?.full_name || "").trim();

    if (!fullName || fullName.length < 2) {
      return jsonResponse({ error: "Full name is required." }, 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(`ip:${ip}`, 12)) {
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

    // Synthetic email — real email is collected later during walk-in booking contact step
    const email = `walkin.${slugifyName(fullName)}.${crypto.randomUUID().slice(0, 8)}@guest.studio8teen.local`;
    const password = randomPassword();
    const expiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "client", is_guest: true },
    });

    if (createErr || !created?.user) {
      console.error(createErr);
      return jsonResponse({ error: createErr?.message || "Could not create guest session." }, 400);
    }

    const userId = created.user.id;

    const { error: profileErr } = await admin.from("profiles").update({
      full_name: fullName,
      phone: null,
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
      return jsonResponse({ error: "Guest created but sign-in failed. Try again." }, 500);
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
