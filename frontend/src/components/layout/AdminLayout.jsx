import AdminSidebar from "../admin/AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen app-shell flex">
      <AdminSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen transition-[margin] duration-300">
        <div className="page-transition">{children}</div>
      </main>
    </div>
  );
}
