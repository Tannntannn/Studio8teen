import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Routes guests may use — booking only (+ claim / create booking). */
const GUEST_ALLOWED = [
  "/client-bookings",
  "/create-booking",
  "/claim-account",
];

function isGuestAllowedPath(pathname) {
  return GUEST_ALLOWED.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
}

export default function ProtectedRoute({ children, role }) {
  const { user, profile, loading, isGuest } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F3]">
        <div className="text-[#5B4636] font-medium">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role === "admin" && profile?.role !== "admin") {
    return <Navigate to="/client-bookings" replace />;
  }

  if (role === "client" && profile?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Guests: booking-only portal (no dashboard / portfolio / mood board / etc.)
  if (role === "client" && isGuest && !isGuestAllowedPath(location.pathname)) {
    return <Navigate to="/client-bookings" replace />;
  }

  return children;
}
