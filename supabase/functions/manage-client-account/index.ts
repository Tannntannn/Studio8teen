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

function isRegistered(profile: { is_guest?: boolean | null; claimed_at?: string | null; email?: string | null }) {
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email || email.endsWith("@guest.studio8teen.local")) return false;
  return !(profile.is_guest && !profile.claimed_at);
}

async function sendNotice(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const resendFrom = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  if (!resendKey) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: resendFrom, to, subject, html }),
  });
  if (!res.ok) {
    console.error("Resend failed:", await res.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: actor } = await admin
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (actor?.role !== "admin") return jsonResponse({ error: "Admins only." }, 403);

    const body = await req.json().catch(() => ({}));
    const targetId = String(body?.user_id || "");
    const action = String(body?.action || "");
    if (!targetId) return jsonResponse({ error: "user_id required" }, 400);
    if (!["deactivate", "reactivate", "delete"].includes(action)) {
      return jsonResponse({ error: "action must be deactivate, reactivate, or delete" }, 400);
    }
    if (targetId === user.id) return jsonResponse({ error: "You cannot change your own account here." }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, address, role, is_guest, claimed_at, deactivated_at")
      .eq("id", targetId)
      .maybeSingle();
    if (!profile) return jsonResponse({ error: "Account not found." }, 404);
    if (profile.role === "admin") return jsonResponse({ error: "Admin accounts cannot be changed here." }, 400);

    const name = profile.full_name?.trim() || "A client";
    const registered = isRegistered(profile);
    const email = String(profile.email || "").trim();

    if (action === "deactivate") {
      const { error: banErr } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h",
      });
      if (banErr) throw banErr;
      const { error } = await admin
        .from("profiles")
        .update({ deactivated_at: new Date().toISOString() })
        .eq("id", targetId);
      if (error) throw error;
      if (registered) {
        await sendNotice(
          email,
          "Your Studio 8Teen account was deactivated",
          `<p>Hello ${name},</p><p>Your Studio 8Teen account has been deactivated. You will not be able to sign in until the studio turns it back on.</p><p>If you think this was a mistake, contact the studio.</p>`
        );
      }
      await admin.from("activity_logs").insert({
        admin_id: user.id,
        action_description: `Admin deactivated ${name}'s account.`,
      });
      return jsonResponse({ ok: true, action, emailed: registered });
    }

    if (action === "reactivate") {
      const { error: banErr } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      });
      if (banErr) throw banErr;
      const { error } = await admin
        .from("profiles")
        .update({ deactivated_at: null })
        .eq("id", targetId);
      if (error) throw error;
      if (registered) {
        await sendNotice(
          email,
          "Your Studio 8Teen account was reactivated",
          `<p>Hello ${name},</p><p>Your Studio 8Teen account is active again. You can sign in as usual.</p>`
        );
      }
      await admin.from("activity_logs").insert({
        admin_id: user.id,
        action_description: `Admin reactivated ${name}'s account.`,
      });
      return jsonResponse({ ok: true, action, emailed: registered });
    }

    const { data: bookings } = await admin
      .from("bookings")
      .select("id, guest_snapshot")
      .eq("client_id", targetId);
    for (const booking of bookings || []) {
      const existing = (booking.guest_snapshot || {}) as Record<string, unknown>;
      await admin
        .from("bookings")
        .update({
          guest_snapshot: {
            ...existing,
            full_name: existing.full_name || profile.full_name,
            email: existing.email || profile.email,
            phone: existing.phone || profile.phone,
            address: existing.address || profile.address,
            deleted_account: true,
          },
        })
        .eq("id", booking.id);
    }

    if (registered) {
      await sendNotice(
        email,
        "Your Studio 8Teen account was deleted",
        `<p>Hello ${name},</p><p>Your Studio 8Teen account has been deleted. You can no longer sign in with this account.</p><p>If you think this was a mistake, contact the studio.</p>`
      );
    }

    await admin.from("payments").update({ verified_by: null }).eq("verified_by", targetId);
    await admin.from("public_portfolio_items").update({ uploaded_by: null }).eq("uploaded_by", targetId);
    await admin.from("client_gallery_items").update({ uploaded_by: null }).eq("uploaded_by", targetId);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) throw delErr;

    await admin.from("activity_logs").insert({
      admin_id: user.id,
      action_description: `Admin deleted ${name}'s account.`,
    });

    return jsonResponse({ ok: true, action, emailed: registered });
  } catch (err) {
    return jsonResponse({ error: err?.message || "Could not update the account." }, 500);
  }
});
