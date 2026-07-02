import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  FaTachometerAlt,
  FaCalendarAlt,
  FaImages,
  FaBell,
  FaUser,
  FaSignOutAlt,
  FaPlus,
  FaCamera,
  FaPalette,
} from "react-icons/fa";
import BrandLogo from "../ui/BrandLogo";
import { useAuth } from "../../context/AuthContext";

const menuItems = [
  { name: "Dashboard", path: "/client-dashboard", icon: FaTachometerAlt },
  { name: "Bookings", path: "/client-bookings", icon: FaCalendarAlt },
  { name: "Portfolio", path: "/client-gallery", icon: FaImages },
  { name: "Mood Board", path: "/client-mood-board", icon: FaPalette },
  { name: "Notifications", path: "/client-notifications", icon: FaBell },
  { name: "Profile", path: "/client-profile", icon: FaUser },
];

const ClientSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await new Promise((r) => setTimeout(r, 350));
    await signOut();
    navigate("/login", { state: { fromLogout: true } });
  };

  return (
    <aside
      className={`group/sidebar fixed left-0 top-0 z-40 h-screen w-20 hover:w-72 bg-white border-r border-[#E8E1DA] flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden shadow-sm ${loggingOut ? "opacity-0 transition-opacity duration-300" : ""}`}
      aria-label="Client navigation"
    >
      <div className="p-5 border-b border-[#E8E1DA] min-h-[88px] flex items-center">
        <BrandLogo to="/client-dashboard" size="sm" />
        <div className="ml-3 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
          <p className="text-xs text-gray-500">Client Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.name}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-[#A98B75] text-white shadow-md"
                    : "text-gray-600 hover:bg-[#F8F6F3]"
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0 mx-1" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap font-medium">
                {item.name}
              </span>
            </NavLink>
          );
        })}

        <NavLink
          to="/create-booking"
          title="New Booking"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#A98B75] border border-[#A98B75]/30 hover:bg-[#A98B75]/10 transition mt-3"
        >
          <FaPlus size={16} className="flex-shrink-0 mx-1.5" />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap font-medium">
            New Booking
          </span>
        </NavLink>

        <NavLink
          to="/client-poses"
          title="Pose Gallery"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-[#F8F6F3] transition"
        >
          <FaCamera size={16} className="flex-shrink-0 mx-1.5" />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Pose Gallery
          </span>
        </NavLink>
      </nav>

      <div className="p-3 border-t border-[#E8E1DA]">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 text-sm transition-colors"
        >
          <FaSignOutAlt size={18} className="flex-shrink-0 mx-1" />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            {loggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default ClientSidebar;
