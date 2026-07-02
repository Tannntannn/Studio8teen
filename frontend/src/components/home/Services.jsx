import {
  FaCamera,
  FaHeart,
  FaBirthdayCake,
  FaPhotoVideo,
  FaBuilding,
} from "react-icons/fa";
import ScrollReveal from "../ui/ScrollReveal";

const services = [
  {
    title: "Studio Sessions",
    description:
      "Professional indoor photoshoots for portraits, graduation, and special occasions.",
    icon: FaCamera,
  },
  {
    title: "Wedding Coverage",
    description:
      "Capture every precious moment of your special day with professional coverage.",
    icon: FaHeart,
  },
  {
    title: "Birthday Events",
    description:
      "Document unforgettable birthday celebrations and family gatherings.",
    icon: FaBirthdayCake,
  },
  {
    title: "Photobooth Rental",
    description:
      "Fun and interactive photobooth experiences for events and parties.",
    icon: FaPhotoVideo,
  },
  {
    title: "Corporate Events",
    description:
      "Professional event photography for conferences, seminars, and business functions.",
    icon: FaBuilding,
  },
];

function Services() {
  return (
    <section id="services" className="py-20 md:py-28 bg-[#F8F6F3] scroll-mt-20">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="
              inline-block px-4 py-1.5 rounded-full
              bg-[#A98B75]/10 text-[#A98B75]
              font-semibold text-sm uppercase tracking-wider
            ">
              Our Services
            </span>

            <h2 className="
              heading-serif mt-5 text-3xl sm:text-4xl md:text-5xl
              font-bold text-gray-800
            ">
              Photography For Every Occasion
            </h2>

            <div className="section-divider" />

            <p className="mt-5 max-w-2xl mx-auto text-gray-500 leading-relaxed">
              Studio 8Teen offers professional photography and event services
              tailored to preserve your most memorable moments.
            </p>
          </div>
        </ScrollReveal>

        {/* Cards */}
        <ScrollReveal delay={200}>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">

            {services.map((service, index) => {
              const Icon = service.icon;

              return (
                <div
                  key={index}
                  className="
                    card-accent bg-white p-6 rounded-2xl
                    shadow-sm hover:shadow-xl
                    transition-all duration-500
                    hover:-translate-y-2 group
                  "
                >
                  <div className="
                    w-14 h-14 rounded-2xl
                    bg-gradient-to-br from-[#A98B75]/15 to-[#A98B75]/5
                    flex items-center justify-center mb-5
                    group-hover:from-[#A98B75] group-hover:to-[#5B4636]
                    transition-all duration-500
                  ">
                    <Icon
                      size={24}
                      className="text-[#A98B75] group-hover:text-white transition-colors duration-500"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {service.title}
                  </h3>

                  <p className="text-gray-500 text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
              );
            })}

          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}

export default Services;