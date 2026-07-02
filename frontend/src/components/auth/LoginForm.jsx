import { useForm } from "react-hook-form";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Swal from "sweetalert2";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);
  const from = location.state?.from?.pathname;
  const fromLogout = location.state?.fromLogout;

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setExiting(true);
      await new Promise((r) => setTimeout(r, 400));
      if (from) navigate(from, { replace: true });
      else if (prof?.role === "admin") navigate("/admin/dashboard", { replace: true });
      else navigate("/client-dashboard", { replace: true });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Login failed", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${exiting ? "login-exit" : ""} ${fromLogout ? "page-transition-auth" : ""}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Email</label>
          <input
            type="email"
            {...register("email", { required: "Email is required" })}
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Password</label>
          <input
            type="password"
            {...register("password", { required: "Password is required" })}
            placeholder="Enter your password"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          <div className="text-right mt-2">
            <Link to="/forgot-password" className="text-sm text-[#A98B75] font-medium hover:underline">
              Forgot Password?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>

      <p className="text-center text-gray-500 mt-6 text-sm">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="text-[#A98B75] font-semibold hover:underline">Register</Link>
      </p>
    </div>
  );
}

export default LoginForm;
