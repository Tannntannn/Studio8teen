import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PageTransition from "./components/layout/PageTransition";
import FaqChatbot from "./components/chatbot/FaqChatbot";

import Home from "./pages/public/Home";
import Login from "./pages/authpage/Login";
import Register from "./pages/authpage/Register";
import ForgotPass from "./pages/authpage/ForgotPass";
import ClientPortfolio from "./pages/public/ClientPortfolio";
import VerifyBooking from "./pages/public/VerifyBooking";
import NotFound from "./pages/public/NotFound";

import Dashboard from "./pages/client/Dashboard";
import Bookings from "./pages/client/Bookings";
import BookingDetail from "./pages/client/BookingDetail";
import CreateBooking from "./pages/client/CreateBooking";
import ClientGallery from "./pages/client/ClientGallery";
import Notifications from "./pages/client/Notifications";
import Profile from "./pages/client/Profile";
import CalendarPage from "./pages/client/Calendar";
import MoodBoard from "./pages/client/MoodBoard";
import MoodBoardGenerator from "./pages/client/MoodBoardGenerator";
import PoseGallery from "./pages/client/PoseGallery";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminBookingDetail from "./pages/admin/AdminBookingDetail";
import AdminClients from "./pages/admin/AdminClients";
import AdminPackages from "./pages/admin/AdminPackages";
import AdminPortfolio from "./pages/admin/AdminPortfolio";
import AdminClientGalleries from "./pages/admin/AdminClientGalleries";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminAvailability from "./pages/admin/AdminAvailability";
import AdminReports from "./pages/admin/AdminReports";
import AdminCancellations from "./pages/admin/AdminCancellations";
import AdminQrScanner from "./pages/admin/AdminQrScanner";
import AdminMoodBoardThemes from "./pages/admin/AdminMoodBoardThemes";

function ChatbotGate() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return null;
  return <FaqChatbot />;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <>
      <PageTransition locationKey={location.pathname}>
        <Routes location={location}>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPass />} />
        <Route path="/client-portfolio" element={<ClientPortfolio />} />
        <Route path="/verify/:token" element={<VerifyBooking />} />

        {/* Client portal */}
        <Route path="/client-dashboard" element={<ProtectedRoute role="client"><Dashboard /></ProtectedRoute>} />
        <Route path="/client-mood-board" element={<ProtectedRoute role="client"><MoodBoardGenerator /></ProtectedRoute>} />
        <Route path="/mood-board" element={<Navigate to="/client-mood-board" replace />} />
        <Route path="/mood-board-generator" element={<Navigate to="/client-mood-board" replace />} />
        <Route path="/client/mood-board" element={<Navigate to="/client-mood-board" replace />} />
        <Route path="/client-bookings" element={<ProtectedRoute role="client"><Bookings /></ProtectedRoute>} />
        <Route path="/client-bookings/:id/mood-board" element={<ProtectedRoute role="client"><MoodBoard /></ProtectedRoute>} />
        <Route path="/client-bookings/:id" element={<ProtectedRoute role="client"><BookingDetail /></ProtectedRoute>} />
        <Route path="/create-booking" element={<ProtectedRoute role="client"><CreateBooking /></ProtectedRoute>} />
        <Route path="/client-gallery" element={<ProtectedRoute role="client"><ClientGallery /></ProtectedRoute>} />
        <Route path="/client-notifications" element={<ProtectedRoute role="client"><Notifications /></ProtectedRoute>} />
        <Route path="/client-profile" element={<ProtectedRoute role="client"><Profile /></ProtectedRoute>} />
        <Route path="/client-calendar" element={<ProtectedRoute role="client"><CalendarPage /></ProtectedRoute>} />
        <Route path="/client-poses" element={<ProtectedRoute role="client"><PoseGallery /></ProtectedRoute>} />

        {/* Admin portal */}
        <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/mood-board-themes" element={<ProtectedRoute role="admin"><AdminMoodBoardThemes /></ProtectedRoute>} />
        <Route path="/admin/mood-board" element={<Navigate to="/admin/mood-board-themes" replace />} />
        <Route path="/admin/mood-themes" element={<Navigate to="/admin/mood-board-themes" replace />} />
        <Route path="/admin/bookings" element={<ProtectedRoute role="admin"><AdminBookings /></ProtectedRoute>} />
        <Route path="/admin/bookings/:id" element={<ProtectedRoute role="admin"><AdminBookingDetail /></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute role="admin"><AdminClients /></ProtectedRoute>} />
        <Route path="/admin/packages" element={<ProtectedRoute role="admin"><AdminPackages /></ProtectedRoute>} />
        <Route path="/admin/portfolio" element={<ProtectedRoute role="admin"><AdminPortfolio /></ProtectedRoute>} />
        <Route path="/admin/client-galleries" element={<ProtectedRoute role="admin"><AdminClientGalleries /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/availability" element={<ProtectedRoute role="admin"><AdminAvailability /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute role="admin"><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/cancellations" element={<ProtectedRoute role="admin"><AdminCancellations /></ProtectedRoute>} />
        <Route path="/admin/qr-scanner" element={<ProtectedRoute role="admin"><AdminQrScanner /></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
        </Routes>
      </PageTransition>
      <ChatbotGate />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
