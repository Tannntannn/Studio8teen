import { useEffect, useState } from "react";
import { FaCheck } from "react-icons/fa";
import { Link } from "react-router-dom";
import ScrollReveal from "../ui/ScrollReveal";
import { getPackages } from "../../services/packages";
import { useAuth } from "../../context/AuthContext";
import { getThumbnailUrl } from "../../lib/cloudinary";
import { PACKAGES_CATALOG } from "../../data/packagesCatalog";

const FALLBACK_PACKAGES = PACKAGES_CATALOG.filter((p) => p.is_popular || p.category === "selfshoot").slice(0, 5).map((p, i) => ({
  id: String(i + 1),
  name: p.name,
  price: p.price,
  features: p.features,
  is_popular: p.is_popular,
  image_url: null,
}));

function bookingPathForPackage(packageId) {
  return `/create-booking?package=${encodeURIComponent(packageId)}`;
}

function Packages() {
  const { user, profile } = useAuth();
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);

  useEffect(() => {
    getPackages()
      .then((data) => { if (data?.length) setPackages(data); })
      .catch(() => {});
  }, []);

  const bookLink = (pkg) => {
    const bookingPath = bookingPathForPackage(pkg.id);
    if (user && profile?.role === "client") return bookingPath;
    if (user && profile?.role === "admin") return "/admin/packages";
    return `/login?redirect=${encodeURIComponent(bookingPath)}`;
  };

  return (
    <section id="packages" className="py-20 md:py-28 bg-[#F8F6F3] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#A98B75]/10 text-[#A98B75] font-semibold text-sm uppercase tracking-wider">
              Packages
            </span>
            <h2 className="heading-serif mt-5 text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800">
              Choose Your Perfect Package
            </h2>
            <div className="section-divider" />
            <p className="mt-5 text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Flexible photography packages tailored for every occasion.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={200}>
          <div className="flex gap-5 overflow-x-auto pb-6 pt-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 sm:overflow-visible sm:pb-0 sm:pt-0">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative flex-shrink-0 w-[85vw] max-w-[320px] snap-center sm:w-auto sm:max-w-none bg-white rounded-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden ${
                  pkg.is_popular ? "shadow-xl ring-2 ring-[#A98B75] sm:xl:scale-105 sm:mt-2" : "shadow-sm hover:shadow-xl"
                }`}
              >
                {pkg.is_popular && (
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-[#A98B75] text-white whitespace-nowrap shadow-lg shadow-[#A98B75]/30 z-10">
                    Most Popular
                  </span>
                )}
                <div className="aspect-[4/3] bg-[#F8F6F3]">
                  {pkg.image_url ? (
                    <img
                      src={getThumbnailUrl(pkg.image_url, 480, 360)}
                      alt={pkg.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 px-4 text-center">
                      Studio 8Teen Package
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-800">{pkg.name}</h3>
                  <div className="mt-4">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Starting at</span>
                    <div className="text-2xl font-bold text-[#A98B75] mt-1">₱{Number(pkg.price).toLocaleString()}</div>
                  </div>
                  <ul className="mt-6 space-y-3">
                    {(Array.isArray(pkg.features) ? pkg.features : []).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-gray-600 text-sm">
                        <span className="w-5 h-5 rounded-full bg-[#A98B75]/10 flex items-center justify-center flex-shrink-0">
                          <FaCheck className="text-[#A98B75] text-[10px]" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {pkg.allows_walk_in && (
                    <p className="mt-3 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5 inline-block">
                      Walk-ins available
                    </p>
                  )}
                  <Link
                    to={bookLink(pkg)}
                    className={`mt-6 w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center ${
                      pkg.is_popular
                        ? "bg-[#A98B75] text-white hover:bg-[#8a7260] hover:shadow-lg hover:shadow-[#A98B75]/25"
                        : "bg-[#A98B75]/10 text-[#A98B75] hover:bg-[#A98B75] hover:text-white"
                    }`}
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default Packages;
