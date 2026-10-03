import { supabase } from "../lib/supabase";

export async function createNotification(userId, type, message) {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    message,
  });
  if (error) throw error;
}

async function currentUserId() {
  const { data: authData } = await supabase.auth.getUser();
  return authData?.user?.id || null;
}

export async function getMyNotifications(limit = 50, { history = false } = {}) {
  const userId = await currentUserId();
  if (!userId) return [];
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  query = history ? query.not("dismissed_at", "is", null) : query.is("dismissed_at", null);
  const { data, error } = await query;
  if (error) {
    if (history) return [];
    const fallback = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return fallback.data || [];
  }
  return data || [];
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function getUnreadCount() {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .is("dismissed_at", null);
  if (error) {
    const fallback = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (fallback.error) throw fallback.error;
    return fallback.count || 0;
  }
  return count || 0;
}

export async function dismissNotification(id) {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString(), is_read: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function dismissAllNotifications() {
  const userId = await currentUserId();
  if (!userId) return;
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString(), is_read: true })
    .eq("user_id", userId)
    .is("dismissed_at", null);
  if (error) throw error;
}

export function subscribeToNotifications(userId, callback, channelKey = "list") {
  return supabase
    .channel(`notifications-${channelKey}-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
}
