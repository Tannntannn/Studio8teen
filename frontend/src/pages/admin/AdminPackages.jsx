import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { createPackage, deletePackage, getAllPackages, syncPackagesFromCatalog, updatePackage } from "../../services/packages";
import { ADDONS_CATALOG, PACKAGES_CATALOG } from "../../data/packagesCatalog";
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
};

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
      text: "This updates all packages to match the official Studio 8Teen package pictures.",
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

  const toggleActive = async (pkg) => {
    await updatePackage(pkg.id, { is_active: !pkg.is_active });
    load();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      await createPackage({
        name: form.name.trim(),
        price: Number(form.price),
        category: form.category,
        description: form.description.trim(),
        features: form.features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
        is_active: true,
        is_popular: form.is_popular,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
      Swal.fire({ icon: "success", title: "Package added", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not add package", text: err.message });
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
              Official pricing from Studio 8Teen package pictures · {PACKAGES_CATALOG.length} packages in catalog
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm"
            >
              {showForm ? "Close form" : "Add package"}
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
          <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6 grid gap-4 md:grid-cols-2">
            <input
              required
              placeholder="Package name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="border rounded-xl px-3 py-2 text-sm"
            />
            <input
              required
              type="number"
              min="0"
              placeholder="Price (₱)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="border rounded-xl px-3 py-2 text-sm"
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="border rounded-xl px-3 py-2 text-sm"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input
              placeholder="Short description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="border rounded-xl px-3 py-2 text-sm"
            />
            <textarea
              placeholder="Features (one per line)"
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              className="border rounded-xl px-3 py-2 text-sm md:col-span-2 min-h-[100px]"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.is_popular}
                onChange={(e) => setForm({ ...form, is_popular: e.target.checked })}
              />
              Mark as popular
            </label>
            <button
              type="submit"
              disabled={saving}
              className="md:col-span-2 px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save package"}
            </button>
          </form>
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
              className={`bg-white rounded-2xl border p-5 ${pkg.is_active ? "border-[#E8E1DA]" : "border-gray-200 opacity-75"}`}
            >
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
              </ul>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => toggleActive(pkg)} className="text-xs text-[#A98B75] font-medium">
                  {pkg.is_active ? "Deactivate" : "Activate"}
                </button>
                <button type="button" onClick={() => handleDelete(pkg)} className="text-xs text-red-500">
                  Remove
                </button>
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
