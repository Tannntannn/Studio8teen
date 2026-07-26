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

const ALLOWED_REDIRECT_HOSTS = new Set([
  "www.studio8teen.org",
  "studio8teen.org",
  "localhost",
  "127.0.0.1",
]);

function isAllowedRedirect(redirectTo: string | undefined, fallback: string): string {
  const candidate = String(redirectTo || fallback || "").trim();
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const allowed =
      ALLOWED_REDIRECT_HOSTS.has(host) ||
      host.endsWith(".studio8teen.org") ||
      host.endsWith(".vercel.app");

    if (!allowed || (url.protocol !== "https:" && host !== "localhost" && host !== "127.0.0.1")) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

// Simple in-memory rate limit (per isolate): max 5 requests / email / 15 min
const rateMap = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string, limit = 5, windowMs = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const row = rateMap.get(key);
  if (!row || now > row.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  row.count += 1;
  return row.count > limit;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email || typeof email !== "string") {
      return jsonResponse({ error: "email required" }, 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return jsonResponse({ error: "invalid email" }, 400);
    }

    if (rateLimited(`email:${normalizedEmail}`) || rateLimited(`ip:${req.headers.get("x-forwarded-for") || "unknown"}`)) {
      // Always look successful to avoid email enumeration / spam amplification
      return jsonResponse({ ok: true });
    }

    const fallbackRedirect =
      Deno.env.get("PASSWORD_RESET_REDIRECT_URL") || "https://www.studio8teen.org/reset-password";
    const safeRedirect = isAllowedRedirect(redirectTo, fallbackRedirect);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: safeRedirect,
      },
    });

    // Do not reveal whether the email exists
    if (error || !data?.properties?.action_link) {
      return jsonResponse({ ok: true });
    }

    const actionLink = data.properties.action_link;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY.");
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: normalizedEmail,
        subject: "Reset your StudioBook password",
        html: `
          <p>Hello,</p>
          <p>Click the button below to reset your StudioBook password.</p>
          <p>
            <a href="${actionLink}" style="display:inline-block;padding:12px 20px;background:#A98B75;color:#ffffff;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
          </p>
          <p>If you did not request this, you can ignore this email.</p>
        `,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text();
      console.error("Resend failed:", detail);
      // Still return ok to avoid leaking provider errors
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error(e);
    return jsonResponse({ ok: true });
  }
});
