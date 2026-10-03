import { useState } from "react";
import { FaBars } from "react-icons/fa";
import AdminSidebar from "../admin/AdminSidebar";
import NotificationBell from "./NotificationBell";

export default function AdminLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen app-shell flex min-w-0">
      <AdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 min-w-0 md:ml-20 min-h-screen flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 md:justify-end md:px-8 pt-4">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="md:hidden w-10 h-10 rounded-xl border border-[#E8E1DA] bg-white text-[#5B4636] flex items-center justify-center"
            aria-label="Open menu"
          >
            <FaBars size={16} />
          </button>
          <NotificationBell />
        </header>
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-x-hidden overflow-y-auto">
          <div className="page-transition min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
