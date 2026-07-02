import LoginForm from "../../components/auth/LoginForm";
import AuthShell from "../../components/layout/AuthShell";

function Login() {
  return (
    <AuthShell title="Welcome Back" subtitle="Sign in to Studio 8Teen">
      <LoginForm />
    </AuthShell>
  );
}

export default Login;
