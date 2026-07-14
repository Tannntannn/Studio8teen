import { Link } from "react-router-dom";
import BrandLogo from "../../components/ui/BrandLogo";
import { STUDIO_PHONE_DISPLAY, STUDIO_EMAIL } from "../../lib/constants";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account, browsing this website, or booking a photography session with Studio 8Teen, you agree to these Terms and Conditions. If you do not agree, please do not use our services.",
  },
  {
    title: "2. Booking and Reservations",
    body: "All bookings are subject to studio availability and confirmation by Studio 8Teen. Selecting a package online does not guarantee a slot until the booking is approved and any required payment steps are completed. Incomplete, unpaid, or unapproved bookings may be cancelled according to studio policy.",
  },
  {
    title: "3. Payments",
    body: "Package prices and add-ons shown in the system are for reference and may be updated by the studio. Downpayments, balances, and accepted payment methods follow the instructions provided in your booking details. Proof of payment may be required before confirmation.",
  },
  {
    title: "4. Cancellations and Rescheduling",
    body: "Cancellation and rescheduling requests must be submitted through the client portal or by contacting the studio. Applicable fees, refunds, and approval timelines follow Studio 8Teen’s cancellation policy. Confirmed bookings remain active until a cancellation is approved.",
  },
  {
    title: "5. Client Responsibilities",
    body: "Clients are responsible for providing accurate contact information, arriving on time, and following studio guidelines during the session. Late arrivals may shorten the booked time slot. Props, wardrobe, and theme preferences should be communicated ahead of the shoot when possible.",
  },
  {
    title: "6. Image Rights and Delivery",
    body: "Studio 8Teen retains copyright over photographs unless otherwise agreed in writing. Soft copies and final deliverables are provided according to the selected package. Edited images may be used by the studio for portfolio and marketing unless the client requests otherwise in writing.",
  },
  {
    title: "7. Account Use",
    body: "You are responsible for keeping your login credentials secure. Accounts are for personal booking use and must not be shared or used to disrupt studio operations. Studio 8Teen may suspend accounts that violate these terms.",
  },
  {
    title: "8. Limitation of Liability",
    body: "Studio 8Teen will take reasonable care during sessions and delivery of services. The studio is not liable for delays or issues caused by circumstances beyond its control, including weather, venue restrictions, equipment failure after reasonable precautions, or inaccurate information provided by the client.",
  },
  {
    title: "9. Changes to These Terms",
    body: "Studio 8Teen may update these Terms and Conditions from time to time. Continued use of the website or booking system after changes are posted constitutes acceptance of the updated terms.",
  },
  {
    title: "10. Contact",
    body: `For questions about these terms or your booking, contact Studio 8Teen at ${STUDIO_PHONE_DISPLAY} or ${STUDIO_EMAIL}.`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#F8F6F3]">
      <header className="bg-white border-b border-[#E8E1DA]">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <BrandLogo to="/" size="md" />
          <Link to="/" className="text-sm text-[#A98B75] font-medium hover:underline">
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A98B75] font-semibold">Legal</p>
        <h1 className="heading-serif text-4xl md:text-5xl font-bold text-[#5B4636] mt-3">
          Terms and Conditions
        </h1>
        <p className="mt-4 text-gray-500 leading-relaxed">
          Please read these terms carefully before registering or booking a session with Studio 8Teen Photography Services.
        </p>

        <div className="mt-10 space-y-6">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="bg-white rounded-2xl border border-[#E8E1DA] p-6 shadow-sm"
            >
              <h2 className="heading-serif text-xl font-semibold text-[#5B4636]">{section.title}</h2>
              <p className="mt-3 text-gray-600 leading-relaxed text-sm md:text-base">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-gray-400">
          Last updated: July 2026
        </p>
      </main>
    </div>
  );
}
