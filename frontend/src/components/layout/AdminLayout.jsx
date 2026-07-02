import AdminSidebar from "../admin/AdminSidebar";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F8F6F3] flex">
      <AdminSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen transition-[margin] duration-300">
        {children}
      </main>
    </div>
  );
}
