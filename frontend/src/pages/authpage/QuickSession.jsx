import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import Swal from "sweetalert2";
import AuthShell from "../../components/layout/AuthShell";
import { startGuestSession } from "../../services/guestSessions";
import { useAuth } from "../../context/AuthContext";

function safeInternalPath(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export default function QuickSession() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const packageId = searchParams.get("package");
  const redirectParam = safeInternalPath(searchParams.get("redirect"));

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await startGuestSession({ fullName: data.fullName });
      await refreshProfile?.();

      const bookingPath = packageId
        ? `/create-booking?package=${encodeURIComponent(packageId)}&mode=walk_in`
        : "/create-booking?mode=walk_in";

      Swal.fire({
        icon: "success",
        title: "Walk-in started",
        text: "Choose a package, then enter your contact details to request a same-day booking.",
        timer: 2600,
        showConfirmButton: false,
      });

      navigate(redirectParam || bookingPath, { replace: true });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Quick session failed",
        text: err.message || "Could not start walk-in session.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Walk-in session"
      subtitle="Name only — contact details come next"
    >
      <p className="text-sm text-gray-500 mb-5 text-center leading-relaxed">
        Enter your name to start. After you pick a package, you&apos;ll add phone, email, and address
        so the studio can confirm your booking.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Full name</label>
          <input
            {...register("fullName", {
              required: "Name is required",
              minLength: { value: 2, message: "Enter your full name" },
            })}
            placeholder="Your full name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
            autoFocus
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50"
        >
          {loading ? "Starting..." : "Continue to booking"}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-[#A98B75] font-semibold hover:underline">Log in</Link>
      </p>
    </AuthShell>
  );
}
