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

/**
 * After admin confirms/completes a walk-in guest booking:
 * 1) Snapshot guest contact onto THIS booking
 * 2) Soft-archive + ban auth only when archive=true (session completed)
 *    and guest has no other open bookings (and was not claimed)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
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

    const { data: adminProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (adminProfile?.role !== "admin") {
      return jsonResponse({ error: "Admin only" }, 403);
    }

    const body = await req.json();
    const bookingId = body.booking_id;
    const shouldArchive = Boolean(body.archive);
    if (!bookingId) return jsonResponse({ error: "booking_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: booking, error: bErr } = await admin
      .from("bookings")
      .select("id, client_id, status, is_walk_in, contact_number, client_address, guest_snapshot")
      .eq("id", bookingId)
      .maybeSingle();
    if (bErr || !booking) return jsonResponse({ error: "Booking not found" }, 404);
    if (!["confirmed", "completed"].includes(booking.status)) {
      return jsonResponse({ error: "Booking must be confirmed or completed first." }, 400);
    }

    const clientId = booking.client_id;
    if (!clientId) return jsonResponse({ ok: true, skipped: "no_client" });

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, address, is_guest, claimed_at, guest_archived_at")
      .eq("id", clientId)
      .maybeSingle();

    if (!profile?.is_guest || profile.claimed_at || profile.guest_archived_at) {
      return jsonResponse({ ok: true, skipped: "not_active_guest" });
    }

    const snapshot = {
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone || booking.contact_number || "",
      address: profile.address || booking.client_address || "",
      archived_at: new Date().toISOString(),
      booking_id: bookingId,
    };

    // Only this booking — do not overwrite sibling bookings' snapshots
    await admin.from("bookings").update({ guest_snapshot: snapshot }).eq("id", bookingId);

    // On payment confirm: snapshot only — keep guest login until session is completed
    if (!shouldArchive && booking.status !== "completed") {
      return jsonResponse({
        ok: true,
        snapshotted: true,
        archived: false,
        skipped: "awaiting_session_complete",
        snapshot,
      });
    }

    // Keep guest login while they still have unfinished bookings
    const { data: openBookings } = await admin
      .from("bookings")
      .select("id, status")
      .eq("client_id", clientId)
      .neq("id", bookingId)
      .in("status", [
        "awaiting_payment",
        "payment_submitted",
        "confirmed",
        "cancellation_pending",
        "cancellation_submitted",
      ]);

    if ((openBookings || []).length > 0) {
      return jsonResponse({
        ok: true,
        snapshotted: true,
        archived: false,
        skipped: "open_bookings_remain",
        open_count: openBookings.length,
        snapshot,
      });
    }

    await admin
      .from("profiles")
      .update({
        guest_archived_at: new Date().toISOString(),
        is_guest: true,
        guest_expires_at: null,
      })
      .eq("id", clientId);

    const randomPass = crypto.randomUUID() + crypto.randomUUID();
    const { error: updErr } = await admin.auth.admin.updateUserById(clientId, {
      password: randomPass,
      ban_duration: "876000h",
      user_metadata: { is_guest: true, archived: true },
    });
    if (updErr) {
      console.error("Could not ban guest auth user:", updErr);
      return jsonResponse({ ok: true, archived: true, ban_error: updErr.message, snapshot });
    }

    return jsonResponse({ ok: true, archived: true, snapshot });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: "Finalize failed." }, 500);
  }
});
