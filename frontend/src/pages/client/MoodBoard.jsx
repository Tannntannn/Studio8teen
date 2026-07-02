import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ClientLayout from "../../components/layout/ClientLayout";
import { getMoodBoard, upsertMoodBoard } from "../../services/gallery";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl } from "../../lib/cloudinary";
import { useAuth } from "../../context/AuthContext";

export default function MoodBoard() {
  const { id: bookingId } = useParams();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getMoodBoard(bookingId).then((board) => setItems(board?.items || [])).catch(console.error);
  }, [bookingId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.moodBoard(bookingId));
      const newItems = [...items, { url, publicId, id: crypto.randomUUID() }];
      await upsertMoodBoard(bookingId, user.id, newItems);
      setItems(newItems);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ClientLayout>
      <div>
        <h1 className="heading-serif text-3xl font-bold text-[#5B4636] mb-2">Session Mood Board</h1>
        <p className="text-gray-500 mb-6">Pin your own inspiration images for this booking.</p>

        <label className="inline-block px-4 py-2 rounded-xl bg-[#A98B75] text-white text-sm cursor-pointer hover:bg-[#8a7260] mb-6">
          {uploading ? "Uploading..." : "Add Image"}
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="aspect-square rounded-xl overflow-hidden">
              <img src={getThumbnailUrl(item.url, 400, 400)} alt="Mood" loading="lazy" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="text-gray-400 text-sm">No images yet. Upload inspiration photos above.</p>}
      </div>
    </ClientLayout>
  );
}
