import { useEffect, useState } from "react";
import PortfolioNavbar from "../../components/portfolio/PortfolioNavbar";
import { getPublicPortfolio } from "../../services/gallery";
import { getGalleryUrl } from "../../lib/cloudinary";

function ClientPortfolio() {
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const categories = ["All", "Wedding", "Birthday", "Studio", "Corporate"];

  useEffect(() => {
    getPublicPortfolio().then(setPortfolioItems).catch(() => setPortfolioItems([]));
  }, []);

  const filteredItems =
    selectedCategory === "All"
      ? portfolioItems
      : portfolioItems.filter((item) => item.category === selectedCategory);

  return (
    <>
      <PortfolioNavbar />
      <section className="min-h-screen bg-[#F8F6F3]">
        <section className="bg-white py-20 border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <span className="inline-block px-4 py-2 rounded-full bg-[#A98B75]/10 text-[#A98B75] font-medium">
              Studio 8Teen Portfolio
            </span>
            <h1 className="heading-serif text-4xl md:text-6xl font-bold text-gray-800 mt-6">
              Our Photography Collection
            </h1>
            <p className="max-w-2xl mx-auto mt-5 text-gray-500 leading-relaxed">
              Explore our collection of weddings, birthdays, studio portraits, and corporate events.
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-5 py-2 rounded-full transition-all ${
                  selectedCategory === category ? "bg-[#A98B75] text-white" : "bg-white text-gray-600 hover:bg-[#A98B75]/10"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <div className="mt-14 bg-white rounded-3xl p-16 text-center shadow-sm">
              <div className="w-20 h-20 mx-auto rounded-full bg-[#A98B75]/10 flex items-center justify-center mb-6 text-2xl">📷</div>
              <h3 className="text-2xl font-semibold text-gray-800">Portfolio Coming Soon</h3>
              <p className="text-gray-500 mt-4 max-w-lg mx-auto">
                Our latest photography works will appear here once uploaded by the administrator.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-14">
              {filteredItems.map((item) => (
                <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all">
                  <img
                    src={getGalleryUrl(item.cloudinary_url, 500)}
                    alt={item.title}
                    loading="lazy"
                    className="w-full h-64 object-cover"
                  />
                  <div className="p-5">
                    <span className="inline-block px-3 py-1 rounded-full bg-[#A98B75]/10 text-[#A98B75] text-sm">{item.category}</span>
                    <h3 className="mt-3 text-xl font-semibold text-gray-800">{item.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default ClientPortfolio;
