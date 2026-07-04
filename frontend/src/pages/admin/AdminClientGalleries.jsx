import { useEffect, useState } from "react";
import { FaTrash } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import ImageLightbox from "../../components/ui/ImageLightbox";
import { getAllClients } from "../../services/profiles";
import { addClientGalleryItem, getClientGalleryByClientId, deleteClientGalleryItem } from "../../services/gallery";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl } from "../../lib/cloudinary";
import { useAuth } from "../../context/AuthContext";
import Swal from "sweetalert2";

export default function AdminClientGalleries() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAllClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    if (!clientId) { setItems([]); return; }
    getClientGalleryByClientId(clientId).then(setItems).catch(console.error);
  }, [clientId]);

  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !clientId) return;
    setUploading(true);
    try {
      await Promise.all(
        files.map(async (file) => {
          const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.clientGallery(clientId));
          await addClientGalleryItem({
            client_id: clientId,
            cloudinary_url: url,
            cloudinary_public_id: publicId,
            uploaded_by: user.id,
          });
        })
      );
      await getClientGalleryByClientId(clientId).then(setItems);
      Swal.fire({
        icon: "success",
        title: files.length === 1 ? "Photo uploaded" : `${files.length} photos uploaded`,
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClientGalleryItem(deleteTarget.id);
      setDeleteTarget(null);
      getClientGalleryByClientId(clientId).then(setItems);
    } finally {
      setDeleting(false);
    }
  };

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Client Galleries</h1>
        <p className="text-gray-500 mb-8">Upload post-shoot photos — select one or many images at once. Click any image to preview full size.</p>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-8">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="border border-[#E8E1DA] rounded-xl px-4 py-2.5 mb-4 w-full max-w-md text-sm"
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
            ))}
          </select>
          <label
            className={`inline-block px-4 py-2.5 rounded-xl text-white text-sm font-medium cursor-pointer transition ${
              clientId ? "bg-[#A98B75] hover:bg-[#8a7260]" : "bg-gray-300 pointer-events-none"
            }`}
          >
            {uploading ? "Uploading..." : "Upload photo(s)"}
            <input type="file" accept="image/*" multiple onChange={handleBulkUpload} className="hidden" disabled={!clientId || uploading} />
          </label>
        </div>

        {clientId && items.length === 0 && !uploading && (
          <p className="text-gray-400 text-sm">No photos for {selectedClient?.full_name} yet.</p>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {items.map((item, i) => (
              <div key={item.id} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition">
                <button type="button" onClick={() => setLightboxIndex(i)} className="w-full h-full">
                  <img
                    src={getThumbnailUrl(item.cloudinary_url, 300, 300)}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600 text-white opacity-0 group-hover:opacity-100 transition"
                  aria-label="Delete photo"
                >
                  <FaTrash size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          images={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          meta={selectedClient ? `${selectedClient.full_name}'s gallery` : ""}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this picture?"
        message="This photo will be permanently removed from the client's gallery. This cannot be undone."
        confirmLabel="Delete picture"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
