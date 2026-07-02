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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, redirectTo } = await req.json();
    if (!email) return jsonResponse({ error: "email required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectTo || Deno.env.get("PASSWORD_RESET_REDIRECT_URL"),
      },
    });

    if (error) throw error;

    const actionLink = data.properties?.action_link;
    if (!actionLink) throw new Error("Could not generate recovery link.");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendKey) {
      throw new Error("Missing RESEND_API_KEY. Replace re_xxxxxxxxx with your real Resend API key.");
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: email,
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
      throw new Error(`Resend request failed: ${detail}`);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ ok: false, error: (e as Error).message }, 500);
  }
});
