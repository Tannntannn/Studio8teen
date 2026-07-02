import RegisterForm from "../../components/auth/RegisterForm";
import AuthShell from "../../components/layout/AuthShell";

function Register() {
  return (
    <AuthShell title="Create Account" subtitle="Join Studio 8Teen">
      <RegisterForm />
    </AuthShell>
  );
}

export default Register;
