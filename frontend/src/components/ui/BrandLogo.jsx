import { Link } from "react-router-dom";
import logo from "../../assets/StudioLogo.jpg";

export default function BrandLogo({ to = "/", className = "", size = "md", showText = false }) {
  const heights = { sm: "h-8", md: "h-10", lg: "h-14" };
  const img = (
    <div className="rounded-xl bg-gradient-to-br from-[#5B4636]/15 to-[#A98B75]/25 p-2 ring-1 ring-[#5B4636]/20 shadow-md">
      <img
        src={logo}
        alt="Studio 8Teen"
        className={`${heights[size] || heights.md} w-auto object-contain contrast-125 saturate-110 drop-shadow-[0_1px_2px_rgba(91,70,54,0.35)]`}
      />
    </div>
  );

  const inner = (
    <>
      {img}
      {showText && (
        <span className="heading-serif font-bold text-[#5B4636] text-lg ml-3 hidden sm:inline">Studio 8Teen</span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`inline-flex items-center flex-shrink-0 ${className}`}>
        {inner}
      </Link>
    );
  }

  return <div className={`inline-flex items-center ${className}`}>{inner}</div>;
}
