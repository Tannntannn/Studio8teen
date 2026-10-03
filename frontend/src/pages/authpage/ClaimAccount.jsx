import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import AuthShell from "../../components/layout/AuthShell";
import PasswordInput from "../../components/ui/PasswordInput";
import ClientLayout from "../../components/layout/ClientLayout";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import { updateProfile } from "../../services/profiles";

export default function ClaimAccount() {
  const { user, profile, isGuest, refreshProfile, loading: authLoading } = useAuth();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const password = watch("password");

  if (authLoading || (user && !profile)) {
    return (
      <AuthShell title="Create password" subtitle="Save your guest session">
        <p className="text-center text-gray-500 text-sm">Loading…</p>
      </AuthShell>
    );
  }

  if (!user) {
    return <Navigate to="/quick-session" replace />;
  }

  if (!isGuest) {
    return (
      <ClientLayout>
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-[#E8E1DA] p-8">
          <h1 className="heading-serif text-2xl font-bold text-[#5B4636]">Account already saved</h1>
          <p className="text-gray-500 text-sm mt-2">Your account is a full client account.</p>
          <Link to="/client-dashboard" className="inline-block mt-6 text-[#A98B75] font-medium hover:underline">
            Back to dashboard
          </Link>
        </div>
      </ClientLayout>
    );
  }

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const contactEmail = String(profile?.email || "").trim();
      const isSynthetic =
        !contactEmail || /@guest\.studio8teen\.local$/i.test(contactEmail) || contactEmail === user.email;

      const authUpdates = { password: data.password };
      // Promote real contact email to login email when guest used a synthetic address
      if (contactEmail && !/@guest\.studio8teen\.local$/i.test(contactEmail) && contactEmail !== user.email) {
        authUpdates.email = contactEmail;
      } else if (isSynthetic && data.login_email) {
        authUpdates.email = data.login_email.trim();
      }

      const { error: authErr } = await supabase.auth.updateUser(authUpdates);
      if (authErr) throw authErr;

      await updateProfile(user.id, {
        is_guest: false,
        claimed_at: new Date().toISOString(),
        guest_expires_at: null,
        guest_archived_at: null,
        ...(authUpdates.email ? { email: authUpdates.email } : {}),
      });
      await refreshProfile();

      Swal.fire({
        icon: "success",
        title: "Account saved!",
        text: authUpdates.email
          ? `You can now log in with ${authUpdates.email}.`
          : "Your bookings and photos are now permanent.",
        timer: 2800,
        showConfirmButton: false,
      });
      navigate("/client-dashboard", { replace: true });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not save account", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const needsLoginEmail = /@guest\.studio8teen\.local$/i.test(String(profile?.email || user?.email || ""));

  return (
    <AuthShell title="Create a password" subtitle="Keep your bookings">
      <p className="text-sm text-gray-500 mb-5 text-center">
        {needsLoginEmail ? (
          <>
            Your walk-in session used a temporary login. Enter the email you want to use permanently, then set a password.
          </>
        ) : (
          <>
            Signed in as <span className="font-medium text-[#5B4636]">{profile?.email || user.email}</span>.
            Set a password so your session is not removed after about 2 days.
            Your booking and payment records stay with the studio either way.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {needsLoginEmail && (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">Login email</label>
            <input
              type="email"
              {...register("login_email", {
                required: "Email is required",
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
              })}
              defaultValue={
                profile?.email && !/@guest\.studio8teen\.local$/i.test(profile.email) ? profile.email : ""
              }
              placeholder="you@email.com"
              className="w-full border border-[#E8E1DA] rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
            />
            {errors.login_email && <p className="text-red-500 text-xs mt-1">{errors.login_email.message}</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Password</label>
          <PasswordInput
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "At least 8 characters" },
            })}
            placeholder="Create a password"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Confirm password</label>
          <PasswordInput
            {...register("confirm", {
              required: "Confirm your password",
              validate: (v) => v === password || "Passwords do not match",
            })}
            placeholder="Confirm password"
          />
          {errors.confirm && <p className="text-red-500 text-xs mt-1">{errors.confirm.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save my account"}
        </button>
      </form>

      <p className="text-center mt-6">
        <Link to="/client-bookings" className="text-sm text-gray-500 hover:text-[#A98B75]">
          Maybe later
        </Link>
      </p>
    </AuthShell>
  );
}
