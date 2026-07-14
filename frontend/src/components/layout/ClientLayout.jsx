import ClientSidebar from "../client/ClientSidebar";

const ClientLayout = ({ children }) => {
  return (
    <div className="min-h-screen app-shell flex">
      <ClientSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen">
        <div className="page-transition">{children}</div>
      </main>
    </div>
  );
};

export default ClientLayout;
