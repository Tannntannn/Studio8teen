import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getAllPackages, syncPackagesFromCatalog, updatePackage } from "../../services/packages";
import { ADDONS_CATALOG, PACKAGES_CATALOG } from "../../data/packagesCatalog";
import Swal from "sweetalert2";

const CATEGORY_LABELS = {
  selfshoot: "Self-Shoot",
  studio: "Studio Sessions",
  photobooth: "Photobooth",
  event: "Event Coverage",
};

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = () => getAllPackages().then(setPackages).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const active = packages.filter((p) => p.is_active);
    if (filter === "all") return active;
    return active.filter((p) => (p.category || "studio") === filter);
  }, [packages, filter]);

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

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Packages</h1>
            <p className="text-gray-500 mt-2">
              Official pricing from Studio 8Teen package pictures · {PACKAGES_CATALOG.length} packages
            </p>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync from catalog"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 mb-10">
          {grouped.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
              <div className="flex justify-between items-start gap-2 mb-2">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-[#A98B75] font-semibold">
                    {CATEGORY_LABELS[pkg.category] || pkg.category || "Package"}
                  </span>
                  <h3 className="font-bold text-[#5B4636] text-lg">{pkg.name}</h3>
                </div>
                {pkg.is_popular && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A98B75] text-white">Popular</span>
                )}
              </div>
              <p className="text-2xl font-bold text-[#A98B75] mb-2">₱{Number(pkg.price).toLocaleString()}</p>
              {pkg.description && <p className="text-sm text-gray-500 mb-3">{pkg.description}</p>}
              <ul className="text-xs text-gray-600 space-y-1 mb-4">
                {(Array.isArray(pkg.features) ? pkg.features : []).map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <button type="button" onClick={() => toggleActive(pkg)} className="text-xs text-[#A98B75]">
                {pkg.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
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
