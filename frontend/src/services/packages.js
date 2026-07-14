import { supabase } from "../lib/supabase";
import { PACKAGES_CATALOG } from "../data/packagesCatalog";

export async function getPackages() {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("is_active", true)
    .order("price");
  if (error) throw error;
  return data || [];
}

export async function getAllPackages() {
  const { data, error } = await supabase.from("packages").select("*").order("price");
  if (error) throw error;
  return data || [];
}

export async function createPackage(pkg) {
  const { data, error } = await supabase.from("packages").insert(pkg).select().single();
  if (error) throw error;
  return data;
}

export async function updatePackage(id, updates) {
  const { data, error } = await supabase.from("packages").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePackage(id) {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

/** Sync authoritative package catalog from Studio 8Teen package pictures */
export async function syncPackagesFromCatalog() {
  const existing = await getAllPackages();
  const byName = Object.fromEntries(existing.map((p) => [p.name, p]));

  for (const pkg of PACKAGES_CATALOG) {
    const existingPkg = byName[pkg.name];
    const row = {
      name: pkg.name,
      price: pkg.price,
      features: pkg.features,
      category: pkg.category,
      description: pkg.description,
      is_active: true,
      is_popular: pkg.is_popular,
    };

    if (existingPkg) {
      // Keep any admin-uploaded package images when syncing catalog text fields.
      await updatePackage(existingPkg.id, row);
    } else {
      await createPackage(row);
    }
  }

  const catalogNames = new Set(PACKAGES_CATALOG.map((p) => p.name));
  for (const old of existing) {
    if (!catalogNames.has(old.name)) {
      await updatePackage(old.id, { is_active: false });
    }
  }

  return getAllPackages();
}
