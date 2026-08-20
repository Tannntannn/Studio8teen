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

  const walkInLink = (pkg) => {
    const bookingPath = `${bookingPathForPackage(pkg.id)}&mode=walk_in`;
    if (user && profile?.role === "client") return bookingPath;
    if (user && profile?.role === "admin") return "/admin/packages";
    return `/quick-session?package=${encodeURIComponent(pkg.id)}`;
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
          <div className="flex gap-5 overflow-x-auto pb-6 pt-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 sm:gap-6 sm:gap-y-8 sm:overflow-visible sm:pb-0 sm:pt-2 sm:items-stretch">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative flex flex-col flex-shrink-0 w-[85vw] max-w-[320px] snap-center sm:w-auto sm:max-w-none sm:h-full bg-white rounded-2xl transition-shadow duration-300 overflow-hidden ${
                  pkg.is_popular
                    ? "shadow-xl ring-2 ring-[#A98B75]"
                    : "shadow-sm hover:shadow-xl"
                }`}
              >
                {pkg.is_popular && (
                  <span className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-[#A98B75] text-white whitespace-nowrap shadow-lg shadow-[#A98B75]/30 z-10">
                    Most Popular
                  </span>
                )}
                <div className="aspect-[4/3] shrink-0 bg-[#F8F6F3]">
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
                <div className="p-6 flex flex-col flex-1 min-h-0">
                  <h3 className="text-lg font-bold text-gray-800">{pkg.name}</h3>
                  <div className="mt-4">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Starting at</span>
                    <div className="text-2xl font-bold text-[#A98B75] mt-1">₱{Number(pkg.price).toLocaleString()}</div>
                  </div>
                  <ul className="mt-6 space-y-3 flex-1">
                    {(Array.isArray(pkg.features) ? pkg.features : []).map((feature, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-gray-600 text-sm">
                        <span className="w-5 h-5 rounded-full bg-[#A98B75]/10 flex items-center justify-center flex-shrink-0">
                          <FaCheck className="text-[#A98B75] text-[10px]" />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 pt-1">
                    {pkg.allows_walk_in && (
                      <p className="mb-3 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5 inline-block">
                        Walk-ins available
                      </p>
                    )}
                    <Link
                      to={bookLink(pkg)}
                      className={`w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center ${
                        pkg.is_popular
                          ? "bg-[#A98B75] text-white hover:bg-[#8a7260] hover:shadow-lg hover:shadow-[#A98B75]/25"
                          : "bg-[#A98B75]/10 text-[#A98B75] hover:bg-[#A98B75] hover:text-white"
                      }`}
                    >
                      Book Now
                    </Link>
                    {pkg.allows_walk_in && (
                      <Link
                        to={walkInLink(pkg)}
                        className="mt-2 w-full py-2.5 rounded-full font-medium text-sm transition-all duration-300 flex items-center justify-center border border-sky-200 text-sky-800 bg-sky-50 hover:bg-sky-100"
                      >
                        Walk in today
                      </Link>
                    )}
                  </div>
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
