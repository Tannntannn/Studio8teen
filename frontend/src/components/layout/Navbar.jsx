import { useState, useEffect } from "react";
import { FaBars, FaTimes } from "react-icons/fa";
import { Link } from "react-router-dom";

import logo from "../../assets/StudioLogo.jpg";
import Container from "./Container";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "Services", href: "#services" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Packages", href: "#packages" },
  { label: "Contact", href: "#contact" },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50 transition-all duration-500
        ${scrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100/80"
          : "bg-white border-b border-gray-100 shadow-sm"
        }
      `}
    >
      <Container>
        <div
          className={`
            flex items-center justify-between transition-all duration-300
            ${scrolled ? "h-16" : "h-20"}
          `}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img
              src={logo}
              alt="Studio 8Teen"
              className={`
                object-contain transition-all duration-300
                ${scrolled ? "h-10" : "h-14"}
              `}
            />
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="
                    relative text-gray-600 font-medium
                    hover:text-[#A98B75] transition-colors duration-300
                    after:content-[''] after:absolute after:bottom-[-4px] after:left-0
                    after:w-0 after:h-[2px] after:bg-[#A98B75]
                    after:transition-all after:duration-300
                    hover:after:w-full
                  "
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="
                px-5 py-2 border border-gray-300 rounded-full
                text-gray-700 hover:border-[#A98B75]
                hover:text-[#A98B75]
                transition-all duration-300
              "
            >
              Login
            </Link>

            <Link
              to="/register"
              className="
                px-6 py-2 rounded-full bg-[#A98B75] text-white
                font-medium hover:bg-[#8a7260]
                hover:shadow-lg hover:shadow-[#A98B75]/25
                transition-all duration-300
              "
            >
              Register
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="
              md:hidden w-10 h-10 flex items-center justify-center
              rounded-xl text-xl text-[#A98B75]
              hover:bg-[#A98B75]/10 transition-all duration-300
            "
            aria-label="Toggle menu"
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </Container>

      {/* Mobile Menu */}
      <div
        className={`
          md:hidden overflow-hidden transition-all duration-500 ease-in-out
          bg-white border-t border-gray-100
          ${menuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="flex flex-col p-6 space-y-1">
          {navLinks.map((link, index) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="
                text-gray-700 font-medium py-3
                hover:text-[#A98B75] hover:pl-2
                transition-all duration-300
                border-b border-gray-50 last:border-0
              "
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {link.label}
            </a>
          ))}

          <div className="pt-4 space-y-3">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="
                block text-center
                w-full py-3 border border-gray-300 rounded-full
                text-gray-700 hover:border-[#A98B75]
                hover:text-[#A98B75]
                transition-all duration-300
              "
            >
              Login
            </Link>

            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="
                block text-center
                w-full py-3 rounded-full
                bg-[#A98B75] text-white
                font-medium hover:bg-[#8a7260]
                transition-all duration-300
              "
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;