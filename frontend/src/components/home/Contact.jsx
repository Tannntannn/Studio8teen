import {
  FaPhoneAlt,
  FaEnvelope,
  FaFacebookF,
  FaMapMarkerAlt,
  FaArrowRight,
} from "react-icons/fa";
import ScrollReveal from "../ui/ScrollReveal";
import { STUDIO_PHONE, STUDIO_PHONE_DISPLAY } from "../../lib/constants";

function Contact() {
  return (
    <section
      id="contact"
      className="py-16 md:py-20 bg-[#A98B75] scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto px-6">

        {/* Heading */}
        <ScrollReveal>
          <div className="text-center text-white">
            <span
              className="
                inline-block px-4 py-1.5 rounded-full
                bg-white/15 backdrop-blur-sm
                text-xs font-medium uppercase tracking-wider
              "
            >
              Get In Touch
            </span>

            <h2
              className="
                heading-serif mt-4 text-3xl md:text-4xl
                font-bold
              "
            >
              Ready To Capture
              <br />
              Your Special Moments?
            </h2>

            <p className="mt-4 max-w-2xl mx-auto text-white/85 leading-relaxed text-sm md:text-base">
              Book your next photography session with Studio 8Teen.
              Whether it's a wedding, birthday, studio shoot, or corporate
              event, we're here to make every moment unforgettable.
            </p>
          </div>
        </ScrollReveal>

        {/* Contact Info Cards */}
        <ScrollReveal delay={200}>
          <div className="grid gap-4 sm:grid-cols-2 mt-12">

            <div
              className="
                bg-white/15 backdrop-blur-sm rounded-2xl
                p-5 text-center text-white
                border border-white/20
                hover:bg-white/25
                transition-all duration-300
              "
            >
              <div
                className="
                  w-10 h-10 mx-auto rounded-full
                  bg-white/20
                  flex items-center justify-center mb-3
                "
              >
                <FaPhoneAlt size={14} />
              </div>

              <h3 className="font-semibold text-base">
                Call Us
              </h3>

              <p className="text-white/80 mt-1 text-sm">
                <a href={`tel:${STUDIO_PHONE}`} className="hover:text-white transition">
                  {STUDIO_PHONE_DISPLAY}
                </a>
              </p>
            </div>

            <div
              className="
                bg-white/15 backdrop-blur-sm rounded-2xl
                p-5 text-center text-white
                border border-white/20
                hover:bg-white/25
                transition-all duration-300
              "
            >
              <div
                className="
                  w-10 h-10 mx-auto rounded-full
                  bg-white/20
                  flex items-center justify-center mb-3
                "
              >
                <FaEnvelope size={14} />
              </div>

              <h3 className="font-semibold text-base">
                Email Us
              </h3>

              <p className="text-white/80 mt-1 text-sm">
                studio8teen@email.com
              </p>
            </div>

          </div>
        </ScrollReveal>

        {/* Action Cards */}
        <ScrollReveal delay={300}>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">

            <a
              href="https://www.facebook.com/profile.php?id=61556578913301"
              target="_blank"
              rel="noopener noreferrer"
              className="
                group bg-[#5B4636]
                text-white rounded-2xl p-6
                text-center hover:shadow-xl
                transition-all duration-300 block
              "
            >
              <div
                className="
                  w-12 h-12 mx-auto rounded-full
                  bg-white/10
                  flex items-center justify-center mb-4
                  group-hover:bg-white/20
                  transition-colors duration-300
                "
              >
                <FaFacebookF size={18} />
              </div>

              <h3 className="text-xl font-semibold">
                Visit Our Facebook Page
              </h3>

              <p className="mt-2 text-white/70 text-sm">
                View our latest shoots, updates,
                and client highlights.
              </p>

              <span
                className="
                  inline-flex items-center gap-2
                  mt-4 font-medium text-sm
                  group-hover:gap-3
                  transition-all duration-300
                "
              >
                Open Facebook
                <FaArrowRight className="text-xs" />
              </span>
            </a>

            <a
              href="https://www.google.com/maps/place/Studio+8Teen+Photography+Services/@14.0283093,121.5896188,17z"
              target="_blank"
              rel="noopener noreferrer"
              className="
                group bg-white
                text-[#5B4636]
                rounded-2xl p-6
                text-center hover:shadow-xl
                transition-all duration-300 block
              "
            >
              <div
                className="
                  w-12 h-12 mx-auto rounded-full
                  bg-[#A98B75]/10
                  flex items-center justify-center mb-4
                  group-hover:bg-[#A98B75]/20
                  transition-colors duration-300
                "
              >
                <FaMapMarkerAlt
                  size={18}
                  className="text-[#A98B75]"
                />
              </div>

              <h3 className="text-xl font-semibold">
                Find Our Studio
              </h3>

              <p className="mt-2 text-gray-500 text-sm">
                Get directions and visit our
                photography studio.
              </p>

              <span
                className="
                  inline-flex items-center gap-2
                  mt-4 font-medium text-sm
                  text-[#A98B75]
                  group-hover:gap-3
                  transition-all duration-300
                "
              >
                Open Google Maps
                <FaArrowRight className="text-xs" />
              </span>
            </a>

          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}

export default Contact;