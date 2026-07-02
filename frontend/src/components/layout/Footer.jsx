import logo from "../../assets/StudioLogo.jpg";
import { FaFacebookF, FaHeart } from "react-icons/fa";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1a1a1a] text-white">

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand */}
          <div>
            <img
              src={logo}
              alt="Studio 8Teen"
              className="h-14 bg-white rounded-xl p-2"
            />
            <p className="mt-5 text-gray-400 leading-relaxed text-sm">
              Capture Every Moment,
              Create Timeless Memories.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider text-gray-300">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {["Home", "Services", "Portfolio", "Packages", "Contact"].map(
                (link) => (
                  <li key={link}>
                    <a
                      href={`#${link.toLowerCase()}`}
                      className="
                        text-gray-400 text-sm hover:text-[#A98B75]
                        hover:pl-1 transition-all duration-300
                      "
                    >
                      {link}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider text-gray-300">
              Contact
            </h3>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li>+63 XXX XXX XXXX</li>
              <li>studio8teen@email.com</li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-sm font-semibold mb-5 uppercase tracking-wider text-gray-300">
              Follow Us
            </h3>
            <a
              href="https://www.facebook.com/profile.php?id=61556578913301"
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center justify-center
                w-11 h-11 rounded-full bg-[#A98B75]
                hover:bg-[#8a7260] hover:scale-110
                hover:shadow-lg hover:shadow-[#A98B75]/30
                transition-all duration-300
              "
            >
              <FaFacebookF size={16} />
            </a>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="
          max-w-7xl mx-auto px-6 py-5
          flex flex-col sm:flex-row items-center justify-between
          gap-2 text-gray-500 text-xs
        ">
          <span>
            © {currentYear} Studio 8Teen Photography Services. All Rights Reserved.
          </span>
          <span className="flex items-center gap-1">
            Made with <FaHeart className="text-[#A98B75] text-[10px]" /> in Tayabas City, Quezon
          </span>
        </div>
      </div>

    </footer>
  );
}

export default Footer;