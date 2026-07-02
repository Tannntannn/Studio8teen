import { useEffect, useState } from "react";
import { FaCheck } from "react-icons/fa";
import { Link } from "react-router-dom";
import ScrollReveal from "../ui/ScrollReveal";
import { getPackages } from "../../services/packages";

import { PACKAGES_CATALOG } from "../../data/packagesCatalog";

const FALLBACK_PACKAGES = PACKAGES_CATALOG.filter((p) => p.is_popular || p.category === "selfshoot").slice(0, 5).map((p, i) => ({
  id: String(i + 1),
  name: p.name,
  price: p.price,
  features: p.features,
  is_popular: p.is_popular,
}));

function Packages() {
  const [packages, setPackages] = useState(FALLBACK_PACKAGES);

  useEffect(() => {
    getPackages()
      .then((data) => { if (data?.length) setPackages(data); })
      .catch(() => {});
  }, []);

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
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative bg-white rounded-2xl p-6 transition-all duration-500 hover:-translate-y-2 ${
                  pkg.is_popular ? "shadow-xl ring-2 ring-[#A98B75] xl:scale-105" : "shadow-sm hover:shadow-xl"
                }`}
              >
                {pkg.is_popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-full bg-[#A98B75] text-white whitespace-nowrap shadow-lg shadow-[#A98B75]/30">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-gray-800 mt-2">{pkg.name}</h3>
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
                <Link
                  to="/login"
                  className={`mt-8 w-full py-3 rounded-full font-medium transition-all duration-300 flex items-center justify-center ${
                    pkg.is_popular
                      ? "bg-[#A98B75] text-white hover:bg-[#8a7260] hover:shadow-lg hover:shadow-[#A98B75]/25"
                      : "bg-[#A98B75]/10 text-[#A98B75] hover:bg-[#A98B75] hover:text-white"
                  }`}
                >
                  Book Now
                </Link>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default Packages;
