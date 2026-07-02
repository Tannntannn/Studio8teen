import { useEffect, useState } from "react";
import { FaCog, FaQrcode, FaPercent, FaFileAlt } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import { getStudioSettings, updateStudioSettings } from "../../services/settings";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import Swal from "sweetalert2";

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [downpayment, setDownpayment] = useState(50);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStudioSettings().then((s) => {
      setSettings(s);
      setDownpayment(s.downpayment_percent || 50);
      setInstructions(s.payment_instructions || "");
    }).catch(console.error);
  }, []);

  const uploadQr = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.paymentQr);
      const updated = await updateStudioSettings({ payment_qr_url: url, payment_qr_public_id: publicId });
      setSettings(updated);
      Swal.fire({ icon: "success", title: "Payment QR updated", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updated = await updateStudioSettings({ downpayment_percent: downpayment, payment_instructions: instructions });
      setSettings(updated);
      Swal.fire({ icon: "success", title: "Settings saved", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#A98B75]/15 text-[#A98B75] mb-4">
            <FaCog size={22} />
          </div>
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Studio Settings</h1>
          <p className="mt-2 text-gray-500">Configure payment options for bookings and cancellations.</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-8 shadow-sm space-y-8">
          <section className="text-center">
            <h3 className="flex items-center justify-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaQrcode className="text-[#A98B75]" /> Payment QR (GCash / Bank)
            </h3>
            {settings?.payment_qr_url ? (
              <img src={settings.payment_qr_url} alt="Payment QR" className="w-44 h-44 object-contain border border-[#E8E1DA] rounded-2xl mx-auto mb-4 shadow-sm" />
            ) : (
              <div className="w-44 h-44 mx-auto mb-4 rounded-2xl border-2 border-dashed border-[#E8E1DA] flex items-center justify-center text-gray-400 text-sm">
                No QR uploaded
              </div>
            )}
            <label className="inline-block px-5 py-2.5 rounded-xl bg-[#A98B75] text-white cursor-pointer text-sm font-medium hover:bg-[#8a7260] transition">
              Upload QR Image
              <input type="file" accept="image/*" onChange={uploadQr} className="hidden" />
            </label>
          </section>

          <section>
            <h3 className="flex items-center justify-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaPercent className="text-[#A98B75]" /> Downpayment
            </h3>
            <div className="flex justify-center">
              <input
                type="number"
                min={10}
                max={90}
                value={downpayment}
                onChange={(e) => setDownpayment(Number(e.target.value))}
                className="border border-[#E8E1DA] rounded-xl px-4 py-3 w-28 text-center text-lg font-semibold text-[#5B4636] outline-none focus:border-[#A98B75]"
              />
              <span className="self-center ml-2 text-gray-500">%</span>
            </div>
          </section>

          <section>
            <h3 className="flex items-center justify-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaFileAlt className="text-[#A98B75]" /> Payment Instructions
            </h3>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Instructions shown to clients when paying..."
              className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] resize-none text-sm"
            />
          </section>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-medium hover:bg-[#4a3829] disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
