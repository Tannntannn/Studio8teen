import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import ImageLightbox from "../../components/ui/ImageLightbox";
import {
  getPoseSuggestions,
  addPoseSuggestion,
  deletePoseSuggestion,
  getPublicPortfolio,
  addPublicPortfolioItem,
  deletePublicPortfolioItem,
} from "../../services/gallery";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl } from "../../lib/cloudinary";
import { useAuth } from "../../context/AuthContext";
import Swal from "sweetalert2";

const POSE_CATEGORIES = ["Portrait", "Couple", "Group", "Wedding", "Creative"];
const PORTFOLIO_CATEGORIES = ["Wedding", "Birthday", "Casual", "Corporate"];

export default function AdminPortfolio() {
  const { user } = useAuth();
  const [poses, setPoses] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [uploadingPose, setUploadingPose] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [poseMeta, setPoseMeta] = useState({ category: "Portrait", description: "" });
  const [portfolioMeta, setPortfolioMeta] = useState({ category: "Casual" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [poseLightboxIndex, setPoseLightboxIndex] = useState(null);
  const [portfolioLightboxIndex, setPortfolioLightboxIndex] = useState(null);

  const loadPoses = () => getPoseSuggestions("All").then(setPoses).catch(console.error);
  const loadPortfolio = () => getPublicPortfolio().then(setPortfolio).catch(console.error);

  useEffect(() => {
    loadPoses();
    loadPortfolio();
  }, []);

  const uploadPose = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPose(true);
    try {
      await Promise.all(
        files.map(async (file, index) => {
          const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.poses);
          const baseDescription = poseMeta.description || poseMeta.category;
          const description = files.length > 1 ? `${baseDescription} (${index + 1})` : baseDescription;
          await addPoseSuggestion({
            category: poseMeta.category,
            description,
            cloudinary_url: url,
            cloudinary_public_id: publicId,
          });
        })
      );
      setPoseMeta((m) => ({ ...m, description: "" }));
      await loadPoses();
      Swal.fire({
        icon: "success",
        title: files.length === 1 ? "Pose uploaded" : `${files.length} poses uploaded`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploadingPose(false);
      e.target.value = "";
    }
  };

  const uploadPortfolio = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPortfolio(true);
    try {
      await Promise.all(
        files.map(async (file, index) => {
          const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.publicPortfolio);
          const title =
            files.length > 1
              ? `${portfolioMeta.category} (${index + 1})`
              : portfolioMeta.category;
          await addPublicPortfolioItem({
            title,
            category: portfolioMeta.category,
            cloudinary_url: url,
            cloudinary_public_id: publicId,
            uploaded_by: user?.id || null,
          });
        })
      );
      await loadPortfolio();
      Swal.fire({
        icon: "success",
        title: files.length === 1 ? "Portfolio image uploaded" : `${files.length} portfolio images uploaded`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploadingPortfolio(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "pose") {
      await deletePoseSuggestion(deleteTarget.item.id);
      loadPoses();
    } else {
      await deletePublicPortfolioItem(deleteTarget.item.id);
      loadPortfolio();
    }
    setDeleteTarget(null);
  };

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Pose Suggestions</h1>
        <p className="text-gray-500 mb-8">Upload poses for clients to browse in the Pose Gallery. You can select one or many images at once.</p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 flex flex-wrap gap-4 items-end mb-8">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={poseMeta.category}
              onChange={(e) => setPoseMeta({ ...poseMeta, category: e.target.value })}
              className="border border-[#E8E1DA] rounded-xl px-4 py-2 text-sm"
            >
              {POSE_CATEGORIES.map((c) => (
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
            {uploadingPose ? "Uploading..." : "Upload pose image(s)"}
            <input type="file" accept="image/*" multiple onChange={uploadPose} className="hidden" disabled={uploadingPose} />
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
                <button type="button" onClick={() => setPoseLightboxIndex(i)} className="w-full h-full">
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
                  onClick={() => setDeleteTarget({ type: "pose", item: pose })}
                  className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <section className="mt-16 pt-10 border-t border-[#E8E1DA]">
          <h2 className="heading-serif text-3xl font-bold text-[#5B4636] mb-2">Public Portfolio</h2>
          <p className="text-gray-500 mb-8">
            Upload work shown on the homepage, public portfolio page, and client Pose Gallery. Select a category, then upload one or many images.
          </p>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 flex flex-wrap gap-4 items-end mb-8">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select
                value={portfolioMeta.category}
                onChange={(e) => setPortfolioMeta({ ...portfolioMeta, category: e.target.value })}
                className="border border-[#E8E1DA] rounded-xl px-4 py-2 text-sm"
              >
                {PORTFOLIO_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <label className="px-4 py-2.5 rounded-xl bg-[#5B4636] text-white cursor-pointer text-sm font-medium hover:bg-[#4a3829] transition">
              {uploadingPortfolio ? "Uploading..." : "Upload portfolio image(s)"}
              <input type="file" accept="image/*" multiple onChange={uploadPortfolio} className="hidden" disabled={uploadingPortfolio} />
            </label>
          </div>

          {portfolio.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-400">
              No public portfolio images yet. Upload your first image above.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {portfolio.map((item, i) => (
                <div
                  key={item.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                  <button type="button" onClick={() => setPortfolioLightboxIndex(i)} className="w-full h-full">
                    <img
                      src={getThumbnailUrl(item.cloudinary_url, 400, 400)}
                      alt={item.title || item.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                      onError={(e) => { e.target.src = item.cloudinary_url; }}
                    />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition">
                    <p className="text-white text-xs font-medium">{item.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget({ type: "portfolio", item })}
                    className="absolute top-2 right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {poseLightboxIndex != null && (
        <ImageLightbox
          images={poses}
          index={poseLightboxIndex}
          onClose={() => setPoseLightboxIndex(null)}
          onNavigate={setPoseLightboxIndex}
          meta={poses[poseLightboxIndex]?.category}
        />
      )}

      {portfolioLightboxIndex != null && (
        <ImageLightbox
          images={portfolio}
          index={portfolioLightboxIndex}
          onClose={() => setPortfolioLightboxIndex(null)}
          onNavigate={setPortfolioLightboxIndex}
          meta={portfolio[portfolioLightboxIndex]?.category}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={deleteTarget?.type === "portfolio" ? "Delete portfolio image?" : "Delete pose?"}
        message={
          deleteTarget?.type === "portfolio"
            ? `Remove this ${deleteTarget?.item?.category || "portfolio"} image from the public portfolio?`
            : `Remove "${deleteTarget?.item?.category}" pose from the gallery? Clients will no longer see it.`
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
