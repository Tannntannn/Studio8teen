import { Link } from "react-router-dom";
import BrandLogo from "../../components/ui/BrandLogo";
import { STUDIO_PHONE_DISPLAY, STUDIO_EMAIL } from "../../lib/constants";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By creating an account, starting a Quick Session / walk-in, browsing this website, or booking a photography session with Studio 8Teen Photography Services, you agree to these Terms and Conditions. If you do not agree, please do not use our services.",
  },
  {
    title: "2. About Studio 8Teen",
    body: "Studio 8Teen offers professional studio photography, event coverage, photobooth services, and related packages. Hours are typically Monday to Saturday, 9:00 AM to 6:00 PM. Sunday sessions are by appointment only. Contact us at " +
      STUDIO_PHONE_DISPLAY +
      " or " +
      STUDIO_EMAIL +
      ".",
  },
  {
    title: "3. Booking and Reservations",
    body: "All bookings are subject to studio availability and confirmation by Studio 8Teen. Selecting a package online does not guarantee a slot until the booking is approved and required payment steps are completed. Incomplete, unpaid, or unapproved bookings may be cancelled according to studio policy. When possible, book at least one (1) week ahead. Walk-ins may use Quick Session for same-day slots on packages that allow walk-ins; guest login access lasts about two (2) days unless you create a password. Booking and payment records remain with the studio.",
  },
  {
    title: "4. Payments",
    body: "You may pay a downpayment (studio default may be around 50%) to confirm your booking, or pay in full. The remaining balance is due before the session/event. We accept GCash, bank transfer, and other methods shown in your booking (including walk-in cash when offered). Scan the payment QR when applicable and upload a clear payment screenshot for verification. Prices and add-ons shown in the system are for reference and may be updated by the studio.",
  },
  {
    title: "5. Cancellations and Rescheduling",
    body: "Cancellations and rescheduling are allowed through the client portal or by contacting the studio. There is no cancellation fee. Cancelling releases the session. Rescheduling is handled by the studio based on availability. If you already paid, you can request a refund from the booking page. The studio returns an approved refund manually, and that approval cancels the booking.",
  },
  {
    title: "6. Late Arrival Policy",
    body: "Please arrive on time (ideally 15 minutes early for preparation). For every 5 minutes late, a fee of ₱50 may apply. If you are 1 hour late without prior notification, your appointment may be rescheduled and a fee of ₱200 may apply. Late arrivals may also shorten your remaining session time — the slot still ends at the originally scheduled time.",
  },
  {
    title: "7. Companions and Studio Use",
    body: "You may bring only one (1) extra companion not included in the shoot. Additional companions may be charged ₱50 each or asked to wait outside. Clients are responsible for any damage to studio equipment or property; penalties equivalent to the damage value may apply (for example, damage to a backdrop). The studio is not responsible for lost or damaged personal belongings — keep valuables with you.",
  },
  {
    title: "8. Outdoor and Location Sessions",
    body: "Outdoor or off-site sessions may be available depending on the package. Select your preferred location when booking. Outdoor sessions may have additional travel fees as communicated by the studio.",
  },
  {
    title: "9. Deliverables and Image Rights",
    body: "Enhanced soft copies are typically delivered through your Client Portfolio in StudioBook, often the same day when possible. Please download or save your photos promptly. Studio 8Teen retains copyright over photographs unless otherwise agreed in writing. Edited images may be used by the studio for portfolio and marketing unless the client requests otherwise in writing.",
  },
  {
    title: "10. Client Responsibilities",
    body: "Provide accurate contact information, follow studio guidelines during the session, and prepare outfits, props, or inspiration references as needed. Mood board suggestions (including auto-generated outfit/prop visuals) are creative guidance only and do not guarantee specific products, rentals, or results.",
  },
  {
    title: "11. Account Use",
    body: "You are responsible for keeping login credentials secure. Guest / walk-in sessions are temporary. Creating a password converts your guest session into a lasting client account. Accounts must not be shared or used to disrupt studio operations. Studio 8Teen may suspend accounts that violate these terms.",
  },
  {
    title: "12. Limitation of Liability",
    body: "Studio 8Teen will take reasonable care during sessions and delivery of services. The studio is not liable for delays or issues caused by circumstances beyond its control, including weather, venue restrictions, equipment failure after reasonable precautions, third-party payment platforms, or inaccurate information provided by the client.",
  },
  {
    title: "13. Changes to These Terms",
    body: "Studio 8Teen may update these Terms and Conditions from time to time. Continued use of the website or booking system after changes are posted constitutes acceptance of the updated terms.",
  },
  {
    title: "14. Contact",
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
          Please read these terms carefully before registering, starting a walk-in Quick Session, or
          booking with Studio 8Teen Photography Services. These terms reflect Studio 8Teen&apos;s
          booking, payment, late, cancellation, and studio-use policies.
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

        <p className="mt-10 text-center text-xs text-gray-400">
          Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}
        </p>
      </main>
    </div>
  );
}
