import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center p-6">
      <div className="text-center">
        <h1 className="heading-serif text-6xl font-bold text-[#5B4636]">404</h1>
        <p className="text-gray-500 mt-4 mb-8">This page doesn&apos;t exist.</p>
        <Link to="/" className="px-6 py-3 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260]">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
