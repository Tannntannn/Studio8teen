import { useEffect, useState } from "react";
import ClientLayout from "../../components/layout/ClientLayout";
import { getPoseSuggestions } from "../../services/gallery";
import { getThumbnailUrl } from "../../lib/cloudinary";

const CATEGORIES = ["All", "Portrait", "Couple", "Group", "Wedding", "Creative"];

export default function PoseGallery() {
  const [poses, setPoses] = useState([]);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    getPoseSuggestions(category).then(setPoses).catch(console.error);
  }, [category]);

  return (
    <ClientLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Pose Suggestions</h1>
        <p className="text-gray-500 mb-6">Browse reference poses for your upcoming session.</p>

        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                category === cat ? "bg-[#A98B75] text-white" : "bg-white border border-[#E8E1DA] text-gray-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {poses.length === 0 ? (
          <p className="text-gray-400">No pose references yet. Check back soon!</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {poses.map((pose) => (
              <div key={pose.id} className="bg-white rounded-xl border border-[#E8E1DA] overflow-hidden">
                <img src={getThumbnailUrl(pose.cloudinary_url)} alt={pose.description} loading="lazy" className="w-full aspect-[3/4] object-cover" />
                {pose.description && <p className="p-3 text-xs text-gray-600">{pose.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
