import { Link } from "react-router-dom";
import BrandLogo from "../ui/BrandLogo";

export default function AuthShell({ children, title, subtitle }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8F6F3] via-[#E8D5C4] to-[#A98B75]/30" />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#A98B75_0%,transparent_50%),radial-gradient(circle_at_80%_80%,#5B4636_0%,transparent_40%)]" />

      <div className="relative w-full max-w-md">
        <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-xl border border-[#E8E1DA]/80">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-[#5B4636]/70 hover:text-[#5B4636] mb-5 transition"
          >
            ← Back to Homepage
          </Link>

          <div className="flex justify-center mb-5">
            <BrandLogo to="/" size="lg" />
          </div>

          {(title || subtitle) && (
            <div className="text-center mb-6">
              {title && <h1 className="heading-serif text-2xl font-bold text-[#5B4636]">{title}</h1>}
              {subtitle && <p className="text-gray-600 mt-1 text-sm">{subtitle}</p>}
            </div>
          )}

          {children}
        </div>
      </div>
    </div>
  );
}
