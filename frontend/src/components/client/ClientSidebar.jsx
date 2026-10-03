import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaSignOutAlt,
  FaPlus,
  FaTachometerAlt,
  FaImages,
  FaBell,
  FaUser,
  FaPalette,
  FaCamera,
  FaKey,
} from "react-icons/fa";
import Swal from "sweetalert2";
import BrandLogo from "../ui/BrandLogo";
import ConfirmModal from "../ui/ConfirmModal";
import { useAuth } from "../../context/AuthContext";

const FULL_MENU = [
  { name: "Dashboard", path: "/client-dashboard", icon: FaTachometerAlt },
  { name: "Bookings", path: "/client-bookings", icon: FaCalendarAlt },
  { name: "Portfolio", path: "/client-gallery", icon: FaImages },
  { name: "Mood Board", path: "/client-mood-board", icon: FaPalette },
  { name: "Notifications", path: "/client-notifications", icon: FaBell },
  { name: "Profile", path: "/client-profile", icon: FaUser },
];

/** Guest / walk-in: Bookings only */
const GUEST_MENU = [
  { name: "Bookings", path: "/client-bookings", icon: FaCalendarAlt },
];

const ClientSidebar = ({ open = false, onClose = () => {} }) => {
  const { signOut, isGuest, profile } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const showGuestNav = isGuest;
  const items = showGuestNav ? GUEST_MENU : FULL_MENU;

  useEffect(() => {
    onClose();
  }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setLogoutOpen(false);
    await new Promise((r) => setTimeout(r, 350));
    await signOut();
    navigate("/login", { state: { fromLogout: true } });
  };

  const requestLogout = async () => {
    if (!showGuestNav) {
      setLogoutOpen(true);
      return;
    }

    const result = await Swal.fire({
      title: "Log out of walk-in?",
      html: `
        <p class="text-sm text-gray-600 text-left">
          Without a password you can’t use normal login. Create a password first, or use
          <strong>Resume walk-in</strong> later with the same email and phone from your booking.
        </p>
      `,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Create password",
      denyButtonText: "Log out anyway",
      cancelButtonText: "Stay",
      confirmButtonColor: "#A98B75",
      denyButtonColor: "#dc2626",
    });

    if (result.isConfirmed) {
      navigate("/claim-account");
      return;
    }
    if (result.isDenied) {
      await handleLogout();
    }
  };

  return (
    <>
      {open && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-[#5B4636]/40"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside
        className={`group/sidebar fixed left-0 top-0 z-50 md:z-40 h-screen w-72 md:w-20 md:hover:w-72 bg-white border-r border-[#E8E1DA] flex flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-sm ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 ${loggingOut ? "opacity-0" : ""}`}
        aria-label="Client navigation"
      >
        <div className="p-5 border-b border-[#E8E1DA] min-h-[88px] flex items-center">
          <BrandLogo to={showGuestNav ? "/client-bookings" : "/client-dashboard"} size="sm" />
          <div className="ml-3 whitespace-nowrap overflow-hidden md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
            <p className="text-xs text-gray-500">{showGuestNav ? "Guest / Walk-in" : "Client Portal"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden ml-auto w-9 h-9 rounded-lg text-gray-500 hover:bg-[#F8F6F3] flex items-center justify-center"
            aria-label="Close menu"
          >
            <FaTimes size={14} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {showGuestNav && (
            <div className="mx-1 mb-3 px-2 py-2 rounded-xl bg-sky-50 border border-sky-100 md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-800">Walk-in</p>
              <p className="text-[11px] text-sky-700 mt-0.5 truncate">{profile?.full_name || "Guest"}</p>
              <p className="text-[10px] text-sky-600 mt-1">Login ~2 days · records stay</p>
            </div>
          )}

          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.name}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    isActive
                      ? "bg-[#A98B75] text-white shadow-md"
                      : "text-gray-600 hover:bg-[#F8F6F3]"
                  }`
                }
              >
                <Icon size={18} className="flex-shrink-0 mx-1" />
                <span className="whitespace-nowrap font-medium md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
                  {item.name}
                </span>
              </NavLink>
            );
          })}

          <NavLink
            to={showGuestNav ? "/create-booking?mode=walk_in" : "/create-booking"}
            title="New Booking"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#A98B75] border border-[#A98B75]/30 hover:bg-[#A98B75]/10 transition mt-3"
          >
            <FaPlus size={16} className="flex-shrink-0 mx-1.5" />
            <span className="whitespace-nowrap font-medium md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
              {showGuestNav ? "New walk-in booking" : "New Booking"}
            </span>
          </NavLink>

          {showGuestNav && (
            <NavLink
              to="/claim-account"
              title="Create password"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sky-700 border border-sky-200 hover:bg-sky-50 transition mt-2"
            >
              <FaKey size={15} className="flex-shrink-0 mx-1.5" />
              <span className="whitespace-nowrap font-medium md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
                Create password
              </span>
            </NavLink>
          )}

          {!showGuestNav && (
            <NavLink
              to="/client-poses"
              title="Pose Gallery"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-[#F8F6F3] transition"
            >
              <FaCamera size={16} className="flex-shrink-0 mx-1.5" />
              <span className="whitespace-nowrap md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
                Pose Gallery
              </span>
            </NavLink>
          )}
        </nav>

        <div className="p-3 border-t border-[#E8E1DA]">
          <button
            type="button"
            onClick={requestLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-500 hover:bg-red-50 text-sm transition-colors"
          >
            <FaSignOutAlt size={18} className="flex-shrink-0 mx-1" />
            <span className="whitespace-nowrap md:opacity-0 md:group-hover/sidebar:opacity-100 transition-opacity duration-300">
              {loggingOut ? "Logging out..." : "Logout"}
            </span>
          </button>
        </div>
      </aside>

      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        message="You’ll need to sign in again to access your bookings and account."
        confirmLabel="Log out"
        cancelLabel="Cancel"
        variant="danger"
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </>
  );
};

export default ClientSidebar;
