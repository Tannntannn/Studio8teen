import { useEffect, useState } from "react";
import { FaCog, FaPercent, FaUser, FaLock, FaQrcode } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import PasswordInput from "../../components/ui/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { getStudioSettings, updateStudioSettings } from "../../services/settings";
import { uploadToCloudinary, CLOUDINARY_FOLDERS } from "../../lib/cloudinary";
import Swal from "sweetalert2";

export default function AdminSettings() {
  const { user, profile } = useAuth();
  const [downpayment, setDownpayment] = useState(50);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrPublicId, setQrPublicId] = useState("");
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    setEmail(user?.email || profile?.email || "");
    getStudioSettings()
      .then((s) => {
        setDownpayment(s.downpayment_percent || 50);
        setAccountName(s.bank_account_name || "");
        setAccountNumber(s.bank_account_number || "");
        setQrUrl(s.payment_qr_url || "");
        setQrPublicId(s.payment_qr_public_id || "");
      })
      .catch(console.error);
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const updates = {};
      if (email && email !== user?.email) updates.email = email;
      if (newPassword) updates.password = newPassword;
      if (!Object.keys(updates).length) {
        Swal.fire({ icon: "info", title: "No changes to save" });
        return;
      }
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      setNewPassword("");
      Swal.fire({ icon: "success", title: "Profile updated", timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update failed", text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await updateStudioSettings({
        downpayment_percent: downpayment,
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
        payment_qr_url: qrUrl || null,
        payment_qr_public_id: qrPublicId || null,
      });
      Swal.fire({ icon: "success", title: "Settings saved", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const uploadQr = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingQr(true);
    try {
      const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.paymentQr);
      setQrUrl(url);
      setQrPublicId(publicId);
    } catch (err) {
      Swal.fire({ icon: "error", title: "QR upload failed", text: err.message });
    } finally {
      setUploadingQr(false);
      event.target.value = "";
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#A98B75]/15 text-[#A98B75] mb-4">
            <FaCog size={22} />
          </div>
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Studio Settings</h1>
          <p className="mt-2 text-gray-500">Update the admin profile, downpayment, and manual payment details.</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-8 shadow-sm space-y-8">
          <section>
            <h3 className="flex items-center justify-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaUser className="text-[#A98B75]" /> Admin Profile
            </h3>
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <FaLock size={12} /> New password
                </label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <button
                type="button"
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full py-3 rounded-xl border border-[#A98B75] text-[#A98B75] font-medium hover:bg-[#A98B75]/10 disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save profile"}
              </button>
            </div>
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
              <FaQrcode className="text-[#A98B75]" /> Manual payment
            </h3>
            <div className="space-y-4 max-w-md mx-auto">
              <div>
                <label className="block text-sm font-medium mb-2">Account name</label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Name on the account"
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Account number</label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Bank or e-wallet number"
                  className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Payment QR</p>
                {qrUrl ? (
                  <img src={qrUrl} alt="Payment QR" className="mb-3 max-h-48 rounded-xl border border-[#E8E1DA] mx-auto" />
                ) : (
                  <p className="text-sm text-gray-400 mb-3">No QR posted yet.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <label className="px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm cursor-pointer">
                    {uploadingQr ? "Uploading..." : qrUrl ? "Change QR" : "Upload QR"}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadQr} disabled={uploadingQr} />
                  </label>
                  {qrUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setQrUrl("");
                        setQrPublicId("");
                      }}
                      className="px-4 py-2 rounded-xl border border-[#E8E1DA] text-sm text-gray-600"
                    >
                      Remove QR
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving || uploadingQr}
            className="w-full py-3 rounded-xl bg-[#5B4636] text-white font-medium hover:bg-[#4a3829] disabled:opacity-50 transition"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
