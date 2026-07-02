import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import ClientLayout from "../../components/layout/ClientLayout";
import { getPackages } from "../../services/packages";
import { createBooking } from "../../services/bookings";
import { getAvailability, ensureMonthAvailability, subscribeAvailability, subscribeBookings, syncMonthAvailability, isSlotBookable } from "../../services/settings";
import { useAuth } from "../../context/AuthContext";
import { ADDONS_CATALOG } from "../../data/packagesCatalog";
import Swal from "sweetalert2";

export default function CreateBooking() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      contact_number: profile?.phone || "",
      client_address: profile?.address || "",
    },
  });
  const [packages, setPackages] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState([]);

  const selectedDate = watch("event_date");
  const selectedPackageId = watch("package_id");

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);
  const basePrice = Number(selectedPackage?.price || 0);
  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = ADDONS_CATALOG.find((a) => a.name === id);
    return sum + (addon?.price || 0);
  }, 0);
  const grandTotal = basePrice + addonsTotal;

  useEffect(() => {
    getPackages().then(setPackages).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDate) { setSlots([]); return; }
    const month = selectedDate.slice(0, 7);
    const loadSlots = async () => {
      try {
        await syncMonthAvailability(month);
        await ensureMonthAvailability(month);
        const data = await getAvailability(selectedDate, selectedDate);
        setSlots(data.filter((s) => s.is_enabled !== false && s.booked_count < s.capacity));
      } catch (err) {
        console.error(err);
      }
    };
    loadSlots();
    const unsubA = subscribeAvailability(loadSlots);
    const unsubB = subscribeBookings(loadSlots);
    return () => {
      unsubA();
      unsubB();
    };
  }, [selectedDate]);

  const toggleAddon = (name) => {
    setSelectedAddons((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const onSubmit = async (data) => {
    if (!user) return;
    setLoading(true);
    try {
      const available = await isSlotBookable(data.event_date, data.time_slot);
      if (!available) {
        throw new Error("That time slot is no longer available. Please pick another.");
      }
      const addonRows = selectedAddons.map((name) => {
        const a = ADDONS_CATALOG.find((x) => x.name === name);
        return { name, price: a?.price || 0 };
      });
      const booking = await createBooking({
        client_id: user.id,
        package_id: data.package_id,
        event_date: data.event_date,
        time_slot: data.time_slot,
        location: data.location,
        notes: data.notes || "",
        contact_number: data.contact_number,
        client_address: data.client_address,
        selected_addons: addonRows,
        addons_total: addonsTotal,
      });
      navigate(`/client-bookings/${booking.id}`);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Booking failed", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-8 text-center">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">Book a Session</h1>
          <p className="mt-2 text-gray-500">Choose a package, add-ons, and available time slot.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 space-y-5">
            <h2 className="font-semibold text-[#5B4636]">Session details</h2>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Package</label>
              <select
                {...register("package_id", { required: "Select a package" })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-[#A98B75] outline-none"
              >
                <option value="">Select Package</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name} — ₱{Number(pkg.price).toLocaleString()}</option>
                ))}
              </select>
              {errors.package_id && <p className="text-red-500 text-xs mt-1">{errors.package_id.message}</p>}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">Preferred Date</label>
                <input type="date" min={new Date().toISOString().split("T")[0]} {...register("event_date", { required: "Select a date" })} className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]" />
                {errors.event_date && <p className="text-red-500 text-xs mt-1">{errors.event_date.message}</p>}
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">Time Slot</label>
                <select {...register("time_slot", { required: "Select a time slot" })} disabled={!selectedDate} className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75] disabled:bg-gray-50">
                  <option value="">{selectedDate ? "Select time" : "Pick a date first"}</option>
                  {slots.map((s) => (
                    <option key={s.id} value={s.time_slot}>{s.time_slot} ({s.capacity - s.booked_count} left)</option>
                  ))}
                </select>
                {errors.time_slot && <p className="text-red-500 text-xs mt-1">{errors.time_slot.message}</p>}
              </div>
            </div>

            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Event Location</label>
              <input {...register("location", { required: "Enter location" })} placeholder="Studio or outdoor location" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]" />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 space-y-4">
            <h2 className="font-semibold text-[#5B4636]">Your contact information</h2>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Contact Number</label>
              <input
                type="tel"
                {...register("contact_number", {
                  required: "Contact number is required",
                  pattern: { value: /^[\d\s+\-()]{7,20}$/, message: "Enter a valid phone number" },
                })}
                placeholder="09XX XXX XXXX"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
              />
              {errors.contact_number && <p className="text-red-500 text-xs mt-1">{errors.contact_number.message}</p>}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Address</label>
              <textarea
                rows={2}
                {...register("client_address", { required: "Address is required" })}
                placeholder="Full address"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]"
              />
              {errors.client_address && <p className="text-red-500 text-xs mt-1">{errors.client_address.message}</p>}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Additional Notes</label>
              <textarea rows={3} {...register("notes")} placeholder="Tell us about your event..." className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
            <h2 className="font-semibold text-[#5B4636] mb-4">Add-ons (optional)</h2>
            <div className="grid sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {ADDONS_CATALOG.slice(0, 12).map((addon) => (
                <label
                  key={addon.name}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    selectedAddons.includes(addon.name)
                      ? "border-[#A98B75] bg-[#A98B75]/10"
                      : "border-[#E8E1DA] hover:bg-[#F8F6F3]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.name)}
                    onChange={() => toggleAddon(addon.name)}
                    className="accent-[#A98B75]"
                  />
                  <span className="text-sm text-gray-700 flex-1">{addon.name}</span>
                  <span className="text-sm font-medium text-[#A98B75]">₱{addon.price.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#5B4636] text-white rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Booking summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between opacity-90">
                <span>Base service{selectedPackage ? `: ${selectedPackage.name}` : ""}</span>
                <span>₱{basePrice.toLocaleString()}</span>
              </div>
              {selectedAddons.map((name) => {
                const a = ADDONS_CATALOG.find((x) => x.name === name);
                return (
                  <div key={name} className="flex justify-between opacity-80">
                    <span>{name}</span>
                    <span>+₱{(a?.price || 0).toLocaleString()}</span>
                  </div>
                );
              })}
              <div className="border-t border-white/20 pt-3 mt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>₱{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl bg-[#A98B75] text-white font-medium hover:bg-[#8a7260] transition disabled:opacity-50">
            {loading ? "Submitting..." : "Submit Booking Request"}
          </button>
        </form>
      </div>
    </ClientLayout>
  );
}
