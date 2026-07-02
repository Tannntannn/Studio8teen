import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FaUser, FaPhone, FaMapMarkerAlt, FaLock } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import { useAuth } from "../../context/AuthContext";
import { updateProfile } from "../../services/profiles";
import { supabase } from "../../lib/supabase";
import Swal from "sweetalert2";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      full_name: "",
      phone: "",
      address: "",
    },
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        address: profile.address || "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await updateProfile(user.id, {
        full_name: data.full_name,
        phone: data.phone,
        address: data.address,
      });
      refreshProfile();
      Swal.fire({ icon: "success", title: "Profile updated", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update failed", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    const { value: password, isConfirmed } = await Swal.fire({
      title: "New password",
      input: "password",
      showCancelButton: true,
    });
    if (isConfirmed && password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) Swal.fire({ icon: "error", text: error.message });
      else Swal.fire({ icon: "success", title: "Password updated" });
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-8 text-center">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Profile</h1>
          <p className="mt-2 text-gray-500">Manage your personal information.</p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 rounded-2xl bg-[#A98B75]/20 flex items-center justify-center text-[#A98B75] text-xl font-bold">
            {(profile?.full_name || "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-[#5B4636]">{profile?.full_name || "Client"}</p>
            <p className="text-sm text-gray-500">{profile?.email || user?.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              Member since {profile?.created_at ? new Date(profile.created_at).getFullYear() : "2026"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h2 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaUser className="text-[#A98B75]" size={16} /> Personal Info
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input {...register("full_name", { required: "Name is required" })} className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]" />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input value={profile?.email || user?.email || ""} disabled className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h2 className="flex items-center gap-2 font-semibold text-[#5B4636] mb-4">
              <FaPhone className="text-[#A98B75]" size={16} /> Contact
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <input {...register("phone")} placeholder="09XX XXX XXXX" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-1"><FaMapMarkerAlt size={12} /> Address</label>
                <textarea {...register("address")} rows={2} className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        <button type="button" onClick={changePassword} className="w-full mt-4 py-3 rounded-xl border border-[#E8E1DA] text-[#5B4636] font-medium hover:bg-[#F8F6F3] flex items-center justify-center gap-2">
          <FaLock size={14} /> Change Password
        </button>
      </div>
    </ClientLayout>
  );
}
