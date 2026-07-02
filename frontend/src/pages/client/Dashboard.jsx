import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCalendarAlt, FaImages, FaBell, FaCheckCircle, FaDownload } from "react-icons/fa";
import Swal from "sweetalert2";
import ClientLayout from "../../components/layout/ClientLayout";
import { getMyBookings } from "../../services/bookings";
import { getUnreadCount } from "../../services/notifications";
import { getClientGallery } from "../../services/gallery";
import { useAuth } from "../../context/AuthContext";
import { downloadBookingReceipt } from "../../lib/bookingReceipt";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ bookings: 0, upcoming: 0, gallery: 0, notifications: 0 });
  const [latestBooking, setLatestBooking] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMyBookings(),
      getUnreadCount(),
      getClientGallery(user.id, 0, 1),
    ]).then(([bookings, notifCount, gallery]) => {
      setStats({
        bookings: bookings.length,
        upcoming: bookings.filter((b) => ["confirmed", "awaiting_payment", "payment_submitted"].includes(b.status)).length,
        gallery: gallery.count,
        notifications: notifCount,
      });
      const active = bookings.find((b) => ["confirmed", "payment_submitted", "awaiting_payment"].includes(b.status));
      setLatestBooking(active || bookings[0] || null);
    }).catch(console.error);
  }, [user]);

  const cards = [
    { title: "Bookings", value: stats.bookings, desc: "Total sessions", icon: FaCalendarAlt, link: "/client-bookings" },
    { title: "Upcoming", value: stats.upcoming, desc: "Active bookings", icon: FaCheckCircle, link: "/client-bookings" },
    { title: "Portfolio", value: stats.gallery, desc: "Your photos", icon: FaImages, link: "/client-gallery" },
    { title: "Notifications", value: stats.notifications, desc: "Unread alerts", icon: FaBell, link: "/client-notifications" },
  ];

  return (
    <ClientLayout>
      <div>
        <div className="mb-8">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">
            Welcome{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-gray-500">Your Studio 8Teen client dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} to={card.link} className="bg-white rounded-2xl p-6 shadow-sm border border-[#E8E1DA] hover:shadow-md transition">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-500 text-sm">{card.title}</p>
                    <h2 className="text-3xl font-bold text-[#5B4636] mt-2">{card.value}</h2>
                    <p className="text-xs text-gray-400 mt-1">{card.desc}</p>
                  </div>
                  <div className="text-[#A98B75] text-2xl"><Icon /></div>
                </div>
              </Link>
            );
          })}
        </div>

        {latestBooking && (
          <div className="mt-8 bg-white rounded-2xl border border-[#E8E1DA] p-6 flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="font-semibold text-[#5B4636]">Latest booking</h2>
              <p className="text-sm text-gray-500 mt-1">
                {latestBooking.packages?.name} · {latestBooking.event_date} · {(latestBooking.status || "").replace(/_/g, " ")}
              </p>
            </div>
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadBookingReceipt(latestBooking, profile);
                  Swal.fire({ icon: "success", title: "PDF downloaded", timer: 1800, showConfirmButton: false });
                } catch (err) {
                  Swal.fire({ icon: "error", title: "Download failed", text: err.message });
                } finally {
                  setDownloading(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5B4636] text-white text-sm font-medium hover:bg-[#4a3829] transition disabled:opacity-50"
            >
              <FaDownload size={14} /> {downloading ? "Generating..." : "Download PDF"}
            </button>
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl border border-[#E8E1DA] p-8 text-center">
          <h2 className="text-xl font-semibold text-[#5B4636]">Ready for your next session?</h2>
          <p className="text-gray-500 mt-2 mb-6">Browse packages and book your photography session.</p>
          <Link to="/create-booking" className="inline-block px-8 py-3 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] transition">
            Book a Session
          </Link>
        </div>
      </div>
    </ClientLayout>
  );
}
