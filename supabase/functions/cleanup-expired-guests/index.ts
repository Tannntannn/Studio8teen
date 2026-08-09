import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cleanup-secret",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Deletes unclaimed guest accounts past guest_expires_at.
 * Protect with CLEANUP_SECRET (header x-cleanup-secret or ?secret=).
 * Schedule via Supabase cron / GitHub Action / external ping daily.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cleanupSecret = Deno.env.get("CLEANUP_SECRET") || "";
    const url = new URL(req.url);
    const headerSecret = req.headers.get("x-cleanup-secret") || "";
    const querySecret = url.searchParams.get("secret") || "";
    const provided = headerSecret || querySecret;

    if (!cleanupSecret || provided !== cleanupSecret) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: expired, error: listErr } = await admin.rpc("list_expired_guest_ids");
    if (listErr) {
      console.error(listErr);
      return jsonResponse({ error: listErr.message }, 500);
    }

    const rows = Array.isArray(expired) ? expired : [];
    const deleted: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const row of rows) {
      const id = row?.id;
      if (!id) continue;
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) {
        failed.push({ id, error: error.message });
      } else {
        deleted.push(id);
      }
    }

    return jsonResponse({
      ok: true,
      scanned: rows.length,
      deleted: deleted.length,
      deleted_ids: deleted,
      failed,
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Cleanup failed." }, 500);
  }
});
