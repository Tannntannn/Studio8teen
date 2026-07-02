import { FaQuoteLeft } from "react-icons/fa";
import ScrollReveal from "../ui/ScrollReveal";

function Testimonials() {
  const testimonials = [
    {
      name: "Maria Santos",
      event: "Wedding Client",
      review:
        "Studio 8Teen captured every special moment beautifully. The photos exceeded our expectations.",
      initials: "MS",
    },
    {
      name: "John Reyes",
      event: "Birthday Celebration",
      review:
        "Professional team, great communication, and amazing photos. Highly recommended.",
      initials: "JR",
    },
    {
      name: "Angela Cruz",
      event: "Studio Session",
      review:
        "The studio environment was comfortable and the results were absolutely stunning.",
      initials: "AC",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-14">
            <span className="
              inline-block px-4 py-1.5 rounded-full
              bg-[#A98B75]/10 text-[#A98B75]
              font-semibold text-sm uppercase tracking-wider
            ">
              Testimonials
            </span>

            <h2 className="
              heading-serif mt-5 text-3xl sm:text-4xl md:text-5xl
              font-bold text-gray-800
            ">
              What Our Clients Say
            </h2>

            <div className="section-divider" />

            <p className="mt-5 text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Trusted by clients for capturing unforgettable memories.
            </p>
          </div>
        </ScrollReveal>

        {/* Testimonial Cards */}
        <ScrollReveal delay={200}>
          <div className="grid gap-6 md:grid-cols-3">

            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="
                  relative bg-[#F8F6F3] p-8 rounded-2xl
                  hover:shadow-xl transition-all duration-500
                  hover:-translate-y-1 group
                "
              >
                {/* Quote Icon */}
                <FaQuoteLeft className="
                  text-[#A98B75]/15 text-4xl mb-4
                  group-hover:text-[#A98B75]/30
                  transition-colors duration-500
                " />

                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-[#A98B75] text-lg">★</span>
                  ))}
                </div>

                <p className="text-gray-600 leading-relaxed italic">
                  &ldquo;{testimonial.review}&rdquo;
                </p>

                <div className="mt-6 flex items-center gap-3">
                  {/* Avatar with initials */}
                  <div className="
                    w-11 h-11 rounded-full
                    bg-gradient-to-br from-[#A98B75] to-[#5B4636]
                    flex items-center justify-center
                    text-white font-semibold text-sm
                  ">
                    {testimonial.initials}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm">
                      {testimonial.name}
                    </h4>
                    <p className="text-gray-400 text-xs">
                      {testimonial.event}
                    </p>
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

export default Testimonials;