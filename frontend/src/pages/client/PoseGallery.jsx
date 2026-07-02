import { useEffect, useState } from "react";
import ClientLayout from "../../components/layout/ClientLayout";
import ImageLightbox from "../../components/ui/ImageLightbox";
import { getPoseSuggestions, getPublicPortfolio } from "../../services/gallery";
import { getThumbnailUrl, getGalleryUrl } from "../../lib/cloudinary";

const CATEGORIES = ["All", "Portrait", "Couple", "Group", "Wedding", "Creative"];
const PORTFOLIO_CATEGORIES = ["All", "Wedding", "Birthday", "Studio", "Corporate"];

export default function PoseGallery() {
  const [poses, setPoses] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [category, setCategory] = useState("All");
  const [portfolioCategory, setPortfolioCategory] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [lightboxImages, setLightboxImages] = useState([]);

  useEffect(() => {
    getPoseSuggestions(category).then(setPoses).catch(console.error);
  }, [category]);

  useEffect(() => {
    getPublicPortfolio().then(setPortfolio).catch(() => setPortfolio([]));
  }, []);

  const filteredPortfolio =
    portfolioCategory === "All"
      ? portfolio
      : portfolio.filter((item) => item.category === portfolioCategory);

  const openLightbox = (images, index) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  };

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
            {poses.map((pose, index) => (
              <button
                key={pose.id}
                type="button"
                onClick={() => openLightbox(poses.map((p) => ({ url: p.cloudinary_url, caption: p.description })), index)}
                className="bg-white rounded-xl border border-[#E8E1DA] overflow-hidden text-left hover:shadow-md transition"
              >
                <img src={getThumbnailUrl(pose.cloudinary_url)} alt={pose.description} loading="lazy" className="w-full aspect-[3/4] object-cover" />
                {pose.description && <p className="p-3 text-xs text-gray-600">{pose.description}</p>}
              </button>
            ))}
          </div>
        )}

        <section className="mt-16 pt-10 border-t border-[#E8E1DA]">
          <h2 className="heading-serif text-3xl font-bold text-[#5B4636] mb-2">Studio Portfolio</h2>
          <p className="text-gray-500 mb-6">Recent work from Studio 8Teen.</p>

          <div className="flex flex-wrap gap-2 mb-6">
            {PORTFOLIO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setPortfolioCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  portfolioCategory === cat ? "bg-[#5B4636] text-white" : "bg-white border border-[#E8E1DA] text-gray-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filteredPortfolio.length === 0 ? (
            <p className="text-gray-400">Portfolio coming soon.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredPortfolio.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    openLightbox(
                      filteredPortfolio.map((p) => ({ url: p.cloudinary_url, caption: p.title })),
                      index
                    )
                  }
                  className="bg-white rounded-xl border border-[#E8E1DA] overflow-hidden text-left hover:shadow-md transition"
                >
                  <img
                    src={getGalleryUrl(item.cloudinary_url, 500)}
                    alt={item.title}
                    loading="lazy"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-3">
                    <p className="text-xs text-[#A98B75] font-medium">{item.category}</p>
                    <p className="text-sm font-semibold text-[#5B4636]">{item.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <ImageLightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </ClientLayout>
  );
}
