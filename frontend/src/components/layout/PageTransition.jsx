export default function PageTransition({ children, locationKey }) {
  const isAuthPage = ["/login", "/register", "/forgot-password"].includes(locationKey);

  return (
    <div
      key={locationKey}
      className={`page-transition ${isAuthPage ? "page-transition-auth" : ""}`}
    >
      {children}
    </div>
  );
}
