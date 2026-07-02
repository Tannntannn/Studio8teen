import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaTachometerAlt,
  FaCalendarAlt,
  FaUsers,
  FaBox,
  FaImages,
  FaChartBar,
  FaCog,
  FaTh,
  FaSignOutAlt,
  FaTimesCircle,
  FaQrcode,
  FaPalette,
} from "react-icons/fa";
import BrandLogo from "../ui/BrandLogo";
import { useAuth } from "../../context/AuthContext";
import { getUnreadPendingCount, subscribePendingBookings } from "../../services/bookings";

const menuItems = [
  { name: "Dashboard", path: "/admin/dashboard", icon: FaTachometerAlt },
  { name: "Bookings", path: "/admin/bookings", icon: FaCalendarAlt, showBadge: true },
  { name: "Clients", path: "/admin/clients", icon: FaUsers },
  { name: "Packages", path: "/admin/packages", icon: FaBox },
  { name: "Poses", path: "/admin/portfolio", icon: FaImages },
  { name: "Mood Board Themes", path: "/admin/mood-board-themes", icon: FaPalette },
  { name: "Client Galleries", path: "/admin/client-galleries", icon: FaImages },
  { name: "Availability", path: "/admin/availability", icon: FaTh },
  { name: "QR Scanner", path: "/admin/qr-scanner", icon: FaQrcode },
  { name: "Cancellations", path: "/admin/cancellations", icon: FaTimesCircle },
  { name: "Reports", path: "/admin/reports", icon: FaChartBar },
  { name: "Settings", path: "/admin/settings", icon: FaCog },
];

export default function AdminSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshUnread = () => {
    getUnreadPendingCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  };

  useEffect(() => {
    refreshUnread();
    return subscribePendingBookings(refreshUnread);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await new Promise((r) => setTimeout(r, 350));
    await signOut();
    navigate("/login", { state: { fromLogout: true } });
  };

  return (
    <aside
      className={`group/sidebar fixed left-0 top-0 z-40 h-screen w-20 hover:w-72 bg-[#5B4636] text-white flex flex-col transition-[width] duration-300 ease-in-out overflow-hidden shadow-lg ${loggingOut ? "opacity-0 transition-opacity duration-300" : ""}`}
      aria-label="Admin navigation"
    >
      <div className="p-5 border-b border-white/10 min-h-[88px] flex items-center">
        <div className="flex-shrink-0 w-10 overflow-hidden rounded-lg bg-white/10 p-0.5 group-hover/sidebar:w-auto">
          <BrandLogo to="/admin/dashboard" size="sm" className="[&_img]:brightness-110" />
        </div>
        <div className="ml-3 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden hidden group-hover/sidebar:block">
          <p className="text-xs text-white/60">Admin Portal</p>
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
                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive ? "bg-[#A98B75] text-white" : "text-white/70 hover:bg-white/10"
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0 mx-1" />
              <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap overflow-hidden">
                {item.name}
              </span>
              {item.showBadge && unreadCount > 0 && (
                <span className="absolute top-1 left-7 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center group-hover/sidebar:static group-hover/sidebar:ml-auto">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-300 hover:bg-white/10 text-sm transition-colors"
        >
          <FaSignOutAlt size={18} className="flex-shrink-0 mx-1" />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            {loggingOut ? "Logging out..." : "Logout"}
          </span>
        </button>
      </div>
    </aside>
  );
}
