import { useEffect, useState } from "react";
import ClientLayout from "../../components/layout/ClientLayout";
import ImageLightbox from "../../components/ui/ImageLightbox";
import { getClientGallery } from "../../services/gallery";
import { getThumbnailUrl } from "../../lib/cloudinary";
import { GALLERY_CATEGORIES } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

export default function ClientGallery() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [category, setCategory] = useState("All");
  const pageSize = 24;

  useEffect(() => {
    if (!user) return;
    getClientGallery(user.id, page, pageSize, category).then(({ items: data, count }) => {
      setItems(data);
      setTotal(count);
    }).catch(console.error);
  }, [user, page, category]);

  return (
    <ClientLayout>
      <div className="max-w-5xl mx-auto w-full">
        <div className="mb-8 text-center">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">My Portfolio</h1>
          <p className="mt-2 text-gray-500">Click any photo to view full size or download.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {["All", ...GALLERY_CATEGORIES].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setCategory(name);
                  setPage(0);
                }}
                className={`px-3 py-1.5 rounded-full text-sm border ${
                  category === name
                    ? "border-[#A98B75] bg-[#A98B75]/10 text-[#5B4636]"
                    : "border-[#E8E1DA] text-gray-500"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center">
            <h2 className="text-xl font-semibold text-[#5B4636]">No photos yet</h2>
            <p className="text-gray-500 mt-2">Your edited photos will appear here after your session.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group"
                >
                  <img
                    src={getThumbnailUrl(item.cloudinary_url)}
                    alt={item.caption || "Photo"}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {item.category && (
                    <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-white/90 text-[#5B4636]">
                      {item.category}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {total > pageSize && (
              <div className="flex justify-center gap-3 mt-8">
                <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl border disabled:opacity-40">Previous</button>
                <span className="py-2 text-sm text-gray-500">Page {page + 1} of {Math.ceil(total / pageSize)}</span>
                <button type="button" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl border disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          images={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </ClientLayout>
  );
}
