import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import ImageLightbox from "../../components/ui/ImageLightbox";
import {
  getPoseSuggestions,
  addPoseSuggestion,
  deletePoseSuggestion,
} from "../../services/gallery";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl } from "../../lib/cloudinary";
import Swal from "sweetalert2";

export default function AdminPortfolio() {
  const [poses, setPoses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [poseMeta, setPoseMeta] = useState({ category: "Portrait", description: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const load = () => getPoseSuggestions("All").then(setPoses).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const uploadPose = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.poses);
      await addPoseSuggestion({
        category: poseMeta.category,
        description: poseMeta.description || poseMeta.category,
        cloudinary_url: url,
        cloudinary_public_id: publicId,
      });
      setPoseMeta((m) => ({ ...m, description: "" }));
      await load();
      Swal.fire({ icon: "success", title: "Pose uploaded", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deletePoseSuggestion(deleteTarget.id);
    setDeleteTarget(null);
    load();
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Pose Suggestions</h1>
        <p className="text-gray-500 mb-8">Upload poses for clients to browse in the Pose Gallery.</p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 flex flex-wrap gap-4 items-end mb-8">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={poseMeta.category}
              onChange={(e) => setPoseMeta({ ...poseMeta, category: e.target.value })}
              className="border border-[#E8E1DA] rounded-xl px-4 py-2 text-sm"
            >
              {["Portrait", "Couple", "Group", "Wedding", "Creative"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input
              placeholder="Optional description"
              value={poseMeta.description}
              onChange={(e) => setPoseMeta({ ...poseMeta, description: e.target.value })}
              className="w-full border border-[#E8E1DA] rounded-xl px-4 py-2 text-sm"
            />
          </div>
          <label className="px-4 py-2.5 rounded-xl bg-[#A98B75] text-white cursor-pointer text-sm font-medium hover:bg-[#8a7260] transition">
            {uploading ? "Uploading..." : "Upload Pose Image"}
            <input type="file" accept="image/*" onChange={uploadPose} className="hidden" disabled={uploading} />
          </label>
        </div>

        {poses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-400">
            No pose suggestions yet. Upload your first pose above.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {poses.map((pose, i) => (
              <div
                key={pose.id}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="w-full h-full"
                >
                  <img
                    src={getThumbnailUrl(pose.cloudinary_url, 400, 500)}
                    alt={pose.description || pose.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                    onError={(e) => { e.target.src = pose.cloudinary_url; }}
                  />
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition">
                  <p className="text-white text-xs font-medium">{pose.category}</p>
                  {pose.description && <p className="text-white/80 text-[10px] truncate">{pose.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(pose)}
                  className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          images={poses}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          meta={poses[lightboxIndex]?.category}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete pose?"
        message={`Remove "${deleteTarget?.category}" pose from the gallery? Clients will no longer see it.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
