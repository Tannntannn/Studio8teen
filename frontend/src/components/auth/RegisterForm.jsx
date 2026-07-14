import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../ui/PasswordInput";
import Swal from "sweetalert2";
import { useState } from "react";

function authErrorMessage(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const status = err.status || err.statusCode;
  const message = err.message || err.msg || err.error_description || err.error || JSON.stringify(err);
  const lower = message.toLowerCase();

  if (status === 504 || lower.includes("504") || lower.includes("gateway timeout")) {
    return "Registration timed out while sending the confirmation email. Your account may still have been created — check your inbox and spam folder. If no email arrives, configure Custom SMTP (Resend) in Supabase → Authentication → SMTP, or temporarily disable email confirmation for testing.";
  }
  if (lower.includes("rate limit")) {
    return "Too many signup emails were sent. Wait about an hour, or connect Resend SMTP in Supabase Auth settings.";
  }
  if (lower.includes("database error saving new user")) {
    return "Account could not be saved. Run supabase/migrations/20260101000002_fix_signup_trigger.sql in the Supabase SQL Editor.";
  }
  return message;
}

function safeInternalPath(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function RegisterForm() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const redirectParam = safeInternalPath(searchParams.get("redirect"));

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await signUp(data.email, data.password, data.fullName);
      Swal.fire({
        icon: "success",
        title: "Account created!",
        text: "Check your email to confirm, then log in.",
      });
      navigate(redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login");
    } catch (err) {
      Swal.fire({ icon: "error", title: "Registration failed", text: authErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const loginLink = redirectParam
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : "/login";

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">Full Name</label>
          <input
            {...register("fullName", { required: "Name is required" })}
            placeholder="Your full name"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            {...register("email", { required: "Email is required" })}
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Password</label>
          <PasswordInput
            {...register("password", { required: "Password is required", minLength: { value: 6, message: "Min 6 characters" } })}
            placeholder="Create a password"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Confirm Password</label>
          <PasswordInput
            {...register("confirmPassword", {
              required: "Confirm your password",
              validate: (v) => v === watch("password") || "Passwords do not match",
            })}
            placeholder="Confirm password"
          />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
        </div>

        <label className="flex items-start gap-3 text-sm text-gray-600">
          <input
            type="checkbox"
            className="mt-1 accent-[#A98B75]"
            {...register("acceptTerms", {
              required: "Please accept the Terms and Conditions",
            })}
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" target="_blank" className="text-[#A98B75] font-semibold hover:underline">
              Terms and Conditions
            </Link>
          </span>
        </label>
        {errors.acceptTerms && <p className="text-red-500 text-xs -mt-3">{errors.acceptTerms.message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6">
        Already have an account?{" "}
        <Link to={loginLink} className="text-[#A98B75] font-semibold hover:underline">Login</Link>
      </p>
    </div>
  );
}

export default RegisterForm;
