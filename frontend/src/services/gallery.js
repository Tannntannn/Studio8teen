import { supabase } from "../lib/supabase";

export async function getPublicPortfolio() {
  const { data, error } = await supabase
    .from("public_portfolio_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addPublicPortfolioItem(item) {
  const { data, error } = await supabase.from("public_portfolio_items").insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function deletePublicPortfolioItem(id) {
  const { error } = await supabase.from("public_portfolio_items").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteClientGalleryItem(id) {
  const { error } = await supabase.from("client_gallery_items").delete().eq("id", id);
  if (error) throw error;
}

export async function getClientGalleryByClientId(clientId) {
  const { data, error } = await supabase
    .from("client_gallery_items")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getClientGallery(clientId, page = 0, pageSize = 24) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("client_gallery_items")
    .select("*", { count: "exact" })
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { items: data || [], count: count || 0 };
}

export async function addClientGalleryItem(item) {
  const { data, error } = await supabase.from("client_gallery_items").insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function getPoseSuggestions(category) {
  let query = supabase.from("pose_suggestions").select("*").order("created_at", { ascending: false });
  if (category && category !== "All") query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function addPoseSuggestion(pose) {
  const { data, error } = await supabase.from("pose_suggestions").insert(pose).select().single();
  if (error) throw error;
  return data;
}

export async function deletePoseSuggestion(id) {
  const { error } = await supabase.from("pose_suggestions").delete().eq("id", id);
  if (error) throw error;
}

export async function getMoodBoard(bookingId) {
  const { data, error } = await supabase.from("mood_boards").select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertMoodBoard(bookingId, clientId, items) {
  const { data, error } = await supabase
    .from("mood_boards")
    .upsert({ booking_id: bookingId, client_id: clientId, items }, { onConflict: "booking_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getChecklist(bookingId) {
  const { data, error } = await supabase.from("event_checklists").select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateChecklist(bookingId, tasks) {
  const { data, error } = await supabase
    .from("event_checklists")
    .update({ tasks })
    .eq("booking_id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export { uploadToCloudinary, getThumbnailUrl, getGalleryUrl, CLOUDINARY_FOLDERS } from "../lib/cloudinary";
