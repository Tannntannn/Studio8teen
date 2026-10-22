import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getRefundRequests, reviewRefundRequest } from "../../services/refunds";
import { useAuth } from "../../context/AuthContext";

const STATUS_LABEL = {
  pending: "Refund pending",
  refunded: "Refunded",
  rejected: "Rejected",
};

export default function AdminRefunds() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => getRefundRequests().then(setItems).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  const review = async (item, status) => {
    setSaving(true);
    setActiveId(item.id);
    try {
      await reviewRefundRequest(item.id, {
        status,
        adminNote: note,
        reviewedBy: user?.id,
      });
      setNote("");
      setActiveId(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Refunds</h1>
          <p className="text-gray-500 mt-2">
            Approve after you send the money back yourself. This does not refund PayMongo and does not replace the ₱100 cancellation fee.
          </p>
        </div>
        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-12 text-center text-gray-400">
            No refund requests yet.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-[#E8E1DA] p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#5B4636]">
                      {item.bookings?.profiles?.full_name || "Client"} — {item.bookings?.packages?.name || "Package"}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {item.bookings?.event_date || "No date"} · ₱{Number(item.amount).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">{item.reason}</p>
                    {item.admin_note && <p className="text-sm text-gray-500 mt-2">Note: {item.admin_note}</p>}
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-[#F8F6F3] text-[#5B4636] h-fit">
                    {STATUS_LABEL[item.status] || item.status}
                  </span>
                </div>
                {item.status === "pending" && (
                  <div className="mt-4 space-y-3">
                    <textarea
                      rows={2}
                      value={activeId === item.id ? note : ""}
                      onFocus={() => setActiveId(item.id)}
                      onChange={(e) => {
                        setActiveId(item.id);
                        setNote(e.target.value);
                      }}
                      placeholder="Note for the client (optional)"
                      className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => review(item, "refunded")}
                        className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm disabled:opacity-50"
                      >
                        Mark refunded
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => review(item, "rejected")}
                        className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
