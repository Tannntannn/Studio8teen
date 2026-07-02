import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import AuthShell from "../../components/layout/AuthShell";
import Swal from "sweetalert2";

function ForgotPass() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      Swal.fire({ icon: "success", title: "Check your email", text: "We sent a password reset link." });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Request failed", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Forgot Password" subtitle="We'll send you a reset link">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] disabled:opacity-50">
          {loading ? "Sending..." : "Reset Password"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link to="/login" className="text-[#A98B75] font-semibold hover:underline text-sm">← Back to Login</Link>
      </div>
    </AuthShell>
  );
}

export default ForgotPass;
