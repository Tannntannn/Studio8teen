import AdminLayout from "../../components/layout/AdminLayout";
import AvailabilityHeatmap from "../../components/admin/AvailabilityHeatmap";

export default function AdminAvailability() {
  return (
    <AdminLayout>
      <div>
        <h1 className="heading-serif text-4xl font-bold text-[#5B4636] mb-2">Availability Heatmap</h1>
        <p className="text-gray-500 mb-8">
          Toggle time slots on or off. Changes sync instantly to the client booking page.
        </p>
        <AvailabilityHeatmap />
      </div>
    </AdminLayout>
  );
}
