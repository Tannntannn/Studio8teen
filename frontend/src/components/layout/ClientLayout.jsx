import ClientSidebar from "../client/ClientSidebar";

const ClientLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#F8F6F3] flex">
      <ClientSidebar />
      <main className="flex-1 ml-20 p-6 md:p-8 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
};

export default ClientLayout;
