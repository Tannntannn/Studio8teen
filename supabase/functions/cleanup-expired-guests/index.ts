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
 * Soft-archives unclaimed guest logins past guest_expires_at.
 * Booking + payment rows stay (guest_snapshot kept on bookings).
 * Does NOT delete auth users — that would CASCADE-delete bookings.
 * Protect with CLEANUP_SECRET (header x-cleanup-secret or ?secret=).
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
    const archived: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const row of rows) {
      const id = row?.id as string | undefined;
      if (!id) continue;

      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("id, full_name, email, phone, address, claimed_at, guest_archived_at, is_guest")
          .eq("id", id)
          .maybeSingle();

        if (!profile || profile.claimed_at || profile.guest_archived_at || !profile.is_guest) {
          continue;
        }

        const { data: bookings } = await admin
          .from("bookings")
          .select("id, contact_number, client_address, guest_snapshot")
          .eq("client_id", id);

        for (const b of bookings || []) {
          const existing = (b.guest_snapshot || {}) as Record<string, unknown>;
          const snapshot = {
            full_name: existing.full_name || profile.full_name,
            email: existing.email || profile.email,
            phone: existing.phone || profile.phone || b.contact_number || "",
            address: existing.address || profile.address || b.client_address || "",
            archived_at: new Date().toISOString(),
            booking_id: b.id,
            reason: "guest_expired",
          };
          await admin.from("bookings").update({ guest_snapshot: snapshot }).eq("id", b.id);
        }

        await admin
          .from("profiles")
          .update({
            guest_archived_at: new Date().toISOString(),
            is_guest: true,
            guest_expires_at: null,
          })
          .eq("id", id);

        const randomPass = crypto.randomUUID() + crypto.randomUUID();
        const { error: updErr } = await admin.auth.admin.updateUserById(id, {
          password: randomPass,
          ban_duration: "876000h",
          user_metadata: { is_guest: true, archived: true },
        });
        if (updErr) {
          failed.push({ id, error: updErr.message });
          continue;
        }

        archived.push(id);
      } catch (e) {
        failed.push({ id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return jsonResponse({
      ok: true,
      scanned: rows.length,
      archived: archived.length,
      archived_ids: archived,
      failed,
      note: "Guest logins soft-archived; bookings and payments retained.",
    });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Cleanup failed." }, 500);
  }
});
