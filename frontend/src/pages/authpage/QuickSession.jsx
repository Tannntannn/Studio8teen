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
      await startGuestSession({
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
      });
      await refreshProfile?.();

      const bookingPath = packageId
        ? `/create-booking?package=${encodeURIComponent(packageId)}&mode=walk_in`
        : "/create-booking?mode=walk_in";

      Swal.fire({
        icon: "success",
        title: "Quick session started",
        text: "You can book today and explore your mood board. Create a password within 7 days to keep everything.",
        timer: 2800,
        showConfirmButton: false,
      });

      navigate(redirectParam || bookingPath, { replace: true });
    } catch (err) {
      const msg = err.message || "Could not start quick session.";
      if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("log in")) {
        Swal.fire({
          icon: "info",
          title: "Account already exists",
          text: msg,
          confirmButtonText: "Go to login",
        }).then((r) => {
          if (r.isConfirmed) {
            const dest = packageId
              ? `/create-booking?package=${encodeURIComponent(packageId)}&mode=walk_in`
              : "/create-booking?mode=walk_in";
            navigate(`/login?redirect=${encodeURIComponent(dest)}`);
          }
        });
      } else {
        Swal.fire({ icon: "error", title: "Quick session failed", text: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Start your studio session"
      subtitle="Walk-in quick start — no password yet"
    >
      <p className="text-sm text-gray-500 mb-5 text-center leading-relaxed">
        Book today, explore your mood board, and upload inspiration photos.
        Create a password anytime within 7 days to keep your session permanently.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Full name</label>
          <input
            {...register("fullName", { required: "Name is required", minLength: { value: 2, message: "Enter your full name" } })}
            placeholder="Your full name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Phone</label>
          <input
            {...register("phone", { required: "Phone is required", minLength: { value: 7, message: "Enter a valid phone number" } })}
            placeholder="09XXXXXXXXX"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
          <input
            type="email"
            {...register("email", { required: "Email is required" })}
            placeholder="you@email.com"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50"
        >
          {loading ? "Starting..." : "Start quick session"}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6 text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-[#A98B75] font-semibold hover:underline">Log in</Link>
      </p>
      <p className="text-center text-gray-400 mt-2 text-xs">
        Want a full account now?{" "}
        <Link to="/register" className="text-[#A98B75] hover:underline">Register</Link>
      </p>
    </AuthShell>
  );
}
