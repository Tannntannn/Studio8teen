import { supabase } from "../lib/supabase";

export async function getMyNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    const fallback = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
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
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  if (error) throw error;
}

export async function getUnreadCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false)
    .is("dismissed_at", null);
  if (error) {
    const fallback = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false);
    if (fallback.error) throw fallback.error;
    return fallback.count || 0;
  }
  return count || 0;
}

export async function dismissNotification(id) {
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString(), is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function dismissAllNotifications() {
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: new Date().toISOString(), is_read: true })
    .is("dismissed_at", null);
  if (error) throw error;
}

export function subscribeToNotifications(userId, callback) {
  return supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
}
