import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import AuthShell from "../../components/layout/AuthShell";
import { resumeGuestSession } from "../../services/guestSessions";
import { useAuth } from "../../context/AuthContext";

export default function ResumeWalkIn() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await resumeGuestSession({
        email: data.email,
        phone: data.phone,
      });
      await refreshProfile?.();

      Swal.fire({
        icon: "success",
        title: "Walk-in restored",
        text: "Welcome back — opening your bookings.",
        timer: 2200,
        showConfirmButton: false,
      });
      navigate("/client-bookings", { replace: true });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Could not resume",
        text: err.message || "No matching open walk-in found.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Resume walk-in"
      subtitle="Use the email and phone from your booking"
    >
      <p className="text-sm text-gray-500 mb-5 text-center leading-relaxed">
        Enter the same contact email and phone you gave when you booked. We&apos;ll reopen that
        guest session so you can finish payment or view your booking.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
          <input
            type="email"
            {...register("email", {
              required: "Email is required",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Enter a valid email",
              },
            })}
            placeholder="you@email.com"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
            autoFocus
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Phone</label>
          <input
            type="tel"
            {...register("phone", {
              required: "Phone is required",
              minLength: { value: 7, message: "Enter a valid phone number" },
            })}
            placeholder="09XX XXX XXXX"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Resume walk-in"}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6 text-sm">
        New walk-in?{" "}
        <Link to="/quick-session" className="text-[#A98B75] font-semibold hover:underline">
          Start a quick session
        </Link>
      </p>
      <p className="text-center text-gray-500 mt-2 text-sm">
        Already created a password?{" "}
        <Link to="/login" className="text-[#A98B75] font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
