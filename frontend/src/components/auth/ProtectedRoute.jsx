import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, profile, loading } = useAuth();
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
    return <Navigate to="/client-dashboard" replace />;
  }

  if (role === "client" && profile?.role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}
