import { Link } from "react-router-dom";
import BrandLogo from "../ui/BrandLogo";

export default function AuthShell({ children, title, subtitle }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden app-shell">
      <div className="absolute inset-0 bg-gradient-to-br from-[#F8F6F3] via-[#E8D5C4]/70 to-[#A98B75]/25" />
      <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#A98B75_0%,transparent_50%),radial-gradient(circle_at_80%_80%,#5B4636_0%,transparent_40%)]" />
      <div className="absolute inset-0 opacity-[0.035] bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%235B4636\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

      <div className="relative w-full max-w-md">
        <div className="surface-card rounded-3xl p-8">
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
