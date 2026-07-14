import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ScrollReveal from "../ui/ScrollReveal";
import ImageLightbox from "../ui/ImageLightbox";
import { getPublicPortfolio } from "../../services/gallery";
import { getGalleryUrl } from "../../lib/cloudinary";

function Portfolio() {
  const [items, setItems] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    getPublicPortfolio()
      .then((data) => setItems(data.slice(0, 6)))
      .catch(() => setItems([]));
  }, []);

  return (
    <section id="portfolio" className="py-20 md:py-28 bg-white scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#A98B75]/10 text-[#A98B75] font-semibold text-sm uppercase tracking-wider">
              Our Portfolio
            </span>
            <h2 className="heading-serif mt-5 text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800">
              Capturing Moments,
              <br />
              Creating Memories
            </h2>
            <div className="section-divider" />
            <p className="mt-5 text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Explore weddings, birthdays, casual sessions, and special events.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          {items.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-[#A98B75]/20 to-[#5B4636]/10 flex items-center justify-center text-gray-400 text-sm">
                  Studio 8Teen
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLightboxIndex(index)}
                  className="group relative overflow-hidden rounded-2xl aspect-[4/3] text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A98B75]"
                >
                  <img
                    src={getGalleryUrl(item.cloudinary_url, 600)}
                    alt={item.title || item.category}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <div>
                      <span className="text-white/70 text-xs uppercase">{item.category}</span>
                      {item.title && item.title !== item.category && (
                        <h3 className="text-white font-semibold">{item.title}</h3>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollReveal>

        <ScrollReveal delay={300}>
          <div className="text-center mt-12">
            <Link to="/client-portfolio" className="inline-block group px-8 py-3.5 rounded-full bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] transition-all">
              View Full Portfolio →
            </Link>
          </div>
        </ScrollReveal>
      </div>

      {lightboxIndex != null && (
        <ImageLightbox
          images={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          meta={items[lightboxIndex]?.category}
        />
      )}
    </section>
  );
}

export default Portfolio;
