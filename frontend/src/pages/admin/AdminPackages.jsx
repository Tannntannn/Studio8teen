import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { createPackage, deletePackage, getAllPackages, syncPackagesFromCatalog, updatePackage } from "../../services/packages";
import { ADDONS_CATALOG, PACKAGES_CATALOG } from "../../data/packagesCatalog";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl } from "../../lib/cloudinary";
import { emptyMobilizationForm, mobilizationsToForm, formToMobilizations, mobilizationLabel, mobilizationFormError } from "../../lib/mobilization";
import MobilizationFields from "../../components/admin/MobilizationFields";
import Swal from "sweetalert2";

const CATEGORY_LABELS = {
  selfshoot: "Self-Shoot",
  studio: "Studio Sessions",
  photobooth: "Photobooth",
  event: "Event Coverage",
};

const EMPTY_FORM = {
  name: "",
  price: "",
  category: "studio",
  description: "",
  features: "",
  is_popular: false,
  allows_walk_in: false,
  is_active: true,
  image_url: "",
  image_public_id: "",
  mobilizations: emptyMobilizationForm(),
};

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = () => getAllPackages().then(setPackages).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    let list = [...packages];
    if (statusFilter === "active") list = list.filter((p) => p.is_active);
    if (statusFilter === "inactive") list = list.filter((p) => !p.is_active);
    if (filter !== "all") list = list.filter((p) => (p.category || "studio") === filter);
    return list;
  }, [packages, filter, statusFilter]);

  const handleSync = async () => {
    const { isConfirmed } = await Swal.fire({
      title: "Sync packages from catalog?",
      text: "This updates package details to match the official Studio 8Teen catalog. Existing package images are kept.",
      icon: "question",
      showCancelButton: true,
    });
    if (!isConfirmed) return;
    setSyncing(true);
    try {
      await syncPackagesFromCatalog();
      await load();
      Swal.fire({ icon: "success", title: "Packages synced", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Sync failed", text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const uploadFormImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.packages);
      setForm((f) => ({ ...f, image_url: url, image_public_id: publicId }));
    } catch (err) {
      Swal.fire({ icon: "error", title: "Image upload failed", text: err.message });
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const closeForm = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  useEffect(() => {
    if (!showForm) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") closeForm();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [showForm, saving]);

  const startEdit = (pkg) => {
    setEditingId(pkg.id);
    setShowForm(true);
    setForm({
      name: pkg.name || "",
      price: pkg.price ?? "",
      category: pkg.category || "studio",
      description: pkg.description || "",
      features: (Array.isArray(pkg.features) ? pkg.features : []).join("\n"),
      is_popular: Boolean(pkg.is_popular),
      allows_walk_in: Boolean(pkg.allows_walk_in),
      is_active: Boolean(pkg.is_active),
      image_url: pkg.image_url || "",
      image_public_id: pkg.image_public_id || "",
      mobilizations: mobilizationsToForm(pkg.mobilizations),
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price === "") return;
    const mobilizationError = mobilizationFormError(form.mobilizations);
    if (mobilizationError) {
      Swal.fire({ icon: "warning", title: mobilizationError });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category,
      description: form.description.trim(),
      features: form.features
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      is_popular: form.is_popular,
      allows_walk_in: form.allows_walk_in,
      is_active: form.is_active,
      image_url: form.image_url || null,
      image_public_id: form.image_public_id || null,
      mobilizations: formToMobilizations(form.mobilizations, form.category),
    };
    try {
      if (editingId) {
        await updatePackage(editingId, { ...payload, catalog_locked: true });
      } else {
        await createPackage({ ...payload, is_active: true, catalog_locked: true });
      }
      closeForm();
      await load();
      Swal.fire({
        icon: "success",
        title: editingId ? "Package updated" : "Package added",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not save package", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg) => {
    const { isConfirmed } = await Swal.fire({
      title: "Remove package?",
      text: `"${pkg.name}" will be permanently deleted. If it has bookings, deactivate it instead.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#c0392b",
    });
    if (!isConfirmed) return;
    try {
      await deletePackage(pkg.id);
      await load();
      Swal.fire({ icon: "success", title: "Package removed", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Could not remove package",
        text: err.message?.includes("foreign key")
          ? "This package has existing bookings. Deactivate it instead of deleting."
          : err.message,
      });
    }
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Packages</h1>
            <p className="text-gray-500 mt-2">
              Official pricing from Studio 8Teen · {PACKAGES_CATALOG.length} packages in catalog
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setShowForm(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm"
            >
              Add package
            </button>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync from catalog"}
            </button>
          </div>
        </div>

        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5B4636]/40 backdrop-blur-sm"
            onClick={closeForm}
            role="dialog"
            aria-modal="true"
            aria-labelledby="package-editor-title"
          >
            <form
              onSubmit={handleSave}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-[#E8E1DA] shadow-2xl"
            >
              <div className="px-6 pt-6 pb-4 border-b border-[#E8E1DA]">
                <h2 id="package-editor-title" className="heading-serif text-2xl font-bold text-[#5B4636]">
                  {editingId ? "Edit package" : "Add package"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Change the name, price, photo, description, and inclusions, then save.
                </p>
              </div>
              <div className="p-6 grid gap-4">
                <label className="block text-sm text-[#5B4636]">
                  Package name
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 w-full border border-[#E8E1DA] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A98B75]"
                  />
                </label>
                <label className="block text-sm text-[#5B4636]">
                  Price (₱)
                  <input
                    required
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="mt-1 w-full border border-[#E8E1DA] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A98B75]"
                  />
                </label>
                <label className="block text-sm text-[#5B4636]">
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full border border-[#E8E1DA] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A98B75]"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-[#5B4636]">
                  Short description
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full border border-[#E8E1DA] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#A98B75]"
                  />
                </label>
                <label className="block text-sm text-[#5B4636]">
                  Inclusions
                  <textarea
                    value={form.features}
                    onChange={(e) => setForm({ ...form, features: e.target.value })}
                    placeholder="One inclusion per line"
                    className="mt-1 w-full border border-[#E8E1DA] rounded-xl px-3 py-2.5 text-sm min-h-[110px] outline-none focus:border-[#A98B75]"
                  />
                </label>
                {form.category === "event" && (
                  <MobilizationFields
                    value={form.mobilizations}
                    onChange={(mobilizations) => setForm((current) => ({ ...current, mobilizations }))}
                  />
                )}
                <div>
                  <p className="text-sm text-[#5B4636] mb-2">Package photo</p>
                  <div className="flex flex-wrap items-center gap-4">
                    {form.image_url ? (
                      <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-[#E8E1DA]">
                        <img src={getThumbnailUrl(form.image_url, 200, 200)} alt="Package preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, image_url: "", image_public_id: "" }))}
                          className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="w-28 h-28 rounded-xl border border-dashed border-[#E8E1DA] bg-[#F8F6F3] flex items-center justify-center text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    <label className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm cursor-pointer hover:bg-[#4a3829]">
                      {uploadingImage ? "Uploading..." : form.image_url ? "Change photo" : "Upload photo"}
                      <input type="file" accept="image/*" className="hidden" onChange={uploadFormImage} disabled={uploadingImage} />
                    </label>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600 rounded-xl border border-[#E8E1DA] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={form.is_popular}
                      onChange={(e) => setForm({ ...form, is_popular: e.target.checked })}
                    />
                    Mark as popular
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 rounded-xl border border-[#E8E1DA] px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={form.allows_walk_in}
                      onChange={(e) => setForm({ ...form, allows_walk_in: e.target.checked })}
                    />
                    Allow walk-ins
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 rounded-xl border border-[#E8E1DA] px-3 py-2.5 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    Package is active
                  </label>
                </div>
              </div>
              <div className="flex gap-3 px-6 py-4 bg-[#F8F6F3] border-t border-[#E8E1DA] sticky bottom-0">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl border border-[#E8E1DA] bg-white text-[#5B4636] text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="flex-1 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save package"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-xs text-gray-500 self-center mr-1">Category:</span>
          <button type="button" onClick={() => setFilter("all")} className={`text-xs px-3 py-1.5 rounded-lg ${filter === "all" ? "bg-[#A98B75] text-white" : "bg-white border"}`}>
            All
          </button>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-lg ${filter === key ? "bg-[#A98B75] text-white" : "bg-white border"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-gray-500 self-center mr-1">Status:</span>
          {[
            ["all", "All"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-lg ${statusFilter === key ? "bg-[#5B4636] text-white" : "bg-white border"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-10">
          {grouped.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-2xl border overflow-hidden ${pkg.is_active ? "border-[#E8E1DA]" : "border-gray-200 opacity-75"}`}
            >
              <div className="relative aspect-[16/10] bg-[#F8F6F3]">
                {pkg.image_url ? (
                  <img
                    src={getThumbnailUrl(pkg.image_url, 600, 380)}
                    alt={pkg.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-gray-400">No package image</div>
                )}
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#A98B75] font-semibold">
                      {CATEGORY_LABELS[pkg.category] || pkg.category || "Package"}
                    </span>
                    <h3 className="font-bold text-[#5B4636] text-lg">{pkg.name}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {pkg.is_popular && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A98B75] text-white">Popular</span>
                    )}
                    {pkg.allows_walk_in && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">Walk-in</span>
                    )}
                    {!pkg.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Inactive</span>
                    )}
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#A98B75] mb-2">₱{Number(pkg.price).toLocaleString()}</p>
                {pkg.description && <p className="text-sm text-gray-500 mb-3">{pkg.description}</p>}
                <ul className="text-xs text-gray-600 space-y-1 mb-4">
                  {(Array.isArray(pkg.features) ? pkg.features : []).map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                  {(Array.isArray(pkg.mobilizations) ? pkg.mobilizations : []).map((item) => (
                    <li key={item.id}>
                      • {mobilizationLabel(item)} · {item.enabled === false ? "Off" : `₱${Number(item.price || 0).toLocaleString()}`}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    type="button"
                    onClick={() => startEdit(pkg)}
                    className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm font-medium hover:bg-[#4a3829]"
                  >
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(pkg)} className="text-xs text-red-500">
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!grouped.length && (
            <p className="text-sm text-gray-500 col-span-full">No packages match this filter.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
          <h2 className="font-semibold text-[#5B4636] mb-4">Add-ons Reference</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
            {ADDONS_CATALOG.map((addon) => (
              <div key={addon.name} className="flex justify-between p-2 rounded-lg bg-[#F8F6F3]">
                <span className="text-gray-700">{addon.name}</span>
                <span className="font-medium text-[#5B4636]">₱{addon.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
