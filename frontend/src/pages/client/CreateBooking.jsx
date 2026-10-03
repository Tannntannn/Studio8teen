import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { FaCheck } from "react-icons/fa";
import ClientLayout from "../../components/layout/ClientLayout";
import BookingDatePicker from "../../components/booking/BookingDatePicker";
import BookingTimeSlotPicker from "../../components/booking/BookingTimeSlotPicker";
import { getPackages } from "../../services/packages";
import { createBooking } from "../../services/bookings";
import {
  ensureMonthAvailability,
  getTimeSlots,
  subscribeAvailability,
  subscribeBookings,
  syncMonthAvailability,
  isSlotBookable,
} from "../../services/settings";
import { getDayStatus, groupAvailabilityByDate } from "../../lib/availabilityUtils";
import { useAuth } from "../../context/AuthContext";
import { ADDONS_CATALOG } from "../../data/packagesCatalog";
import { getThumbnailUrl } from "../../lib/cloudinary";
import { localDateISO } from "../../lib/dateUtils";
import { RESERVATION_FEE } from "../../lib/constants";
import Swal from "sweetalert2";
import { updateProfile } from "../../services/profiles";

function formatLongDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function CreateBooking() {
  const { user, profile, isGuest } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packageFromUrl = searchParams.get("package");
  const modeFromUrl = searchParams.get("mode");
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      contact_number: profile?.phone || "",
      client_address: profile?.address || "",
      contact_email: "",
      event_date: "",
      time_slot: "",
      package_id: packageFromUrl || "",
      booking_mode: modeFromUrl === "walk_in" || isGuest ? "walk_in" : "scheduled",
      location: "Studio 8Teen",
    },
  });
  const [packages, setPackages] = useState([]);
  const [monthAvailability, setMonthAvailability] = useState([]);
  const [timeSlotTimes, setTimeSlotTimes] = useState([]);
  const [bookingMonth, setBookingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState([]);

  const selectedDate = watch("event_date");
  const selectedTimeSlot = watch("time_slot");
  const selectedPackageId = watch("package_id");
  const bookingMode = watch("booking_mode");

  const selectablePackages = useMemo(() => {
    if (isGuest || modeFromUrl === "walk_in") {
      return packages.filter((p) => p.allows_walk_in);
    }
    return packages;
  }, [packages, isGuest, modeFromUrl]);

  const selectedPackage = selectablePackages.find((p) => p.id === selectedPackageId)
    || packages.find((p) => p.id === selectedPackageId);
  const allowsWalkIn = Boolean(selectedPackage?.allows_walk_in);
  const todayIso = useMemo(() => localDateISO(), []);

  const basePrice = Number(selectedPackage?.price || 0);
  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = ADDONS_CATALOG.find((a) => a.name === id);
    return sum + (addon?.price || 0);
  }, 0);
  const grandTotal = basePrice + addonsTotal;
  const inclusions = Array.isArray(selectedPackage?.features) ? selectedPackage.features : [];

  const availabilityByDate = groupAvailabilityByDate(monthAvailability);
  const slotsForSelectedDate = selectedDate ? monthAvailability.filter((s) => s.avail_date === selectedDate) : [];
  const dayStatus = selectedDate
    ? getDayStatus(availabilityByDate[selectedDate] || [])
    : null;

  useEffect(() => {
    getPackages()
      .then((data) => {
        setPackages(data);
        const walkInOnly = isGuest || modeFromUrl === "walk_in";
        const list = walkInOnly ? data.filter((p) => p.allows_walk_in) : data;

        if (packageFromUrl) {
          const fromUrl = data.find((p) => p.id === packageFromUrl);
          if (fromUrl && (!walkInOnly || fromUrl.allows_walk_in)) {
            setValue("package_id", packageFromUrl, { shouldValidate: true });
          } else if (fromUrl && walkInOnly && !fromUrl.allows_walk_in) {
            setValue("package_id", "", { shouldValidate: true });
            Swal.fire({
              icon: "info",
              title: "Package not available for walk-in",
              text: "That package does not accept walk-ins. Choose a walk-in package, or ask the studio to enable walk-in on it.",
              timer: 4000,
              showConfirmButton: true,
            });
          }
        }

        if (walkInOnly && list.length === 0) {
          // empty state handled in UI
        }
      })
      .catch(console.error);
    getTimeSlots().then(setTimeSlotTimes).catch(() => {});
  }, [packageFromUrl, setValue, isGuest, modeFromUrl]);

  // Guests / walk-in URL stay on walk-in mode. Registered users need package allows_walk_in.
  useEffect(() => {
    if (isGuest || modeFromUrl === "walk_in") {
      setValue("booking_mode", "walk_in", { shouldValidate: true });
      return;
    }
    if (!allowsWalkIn && bookingMode === "walk_in") {
      setValue("booking_mode", "scheduled");
    }
  }, [isGuest, modeFromUrl, allowsWalkIn, bookingMode, setValue]);

  // Clear selection if package is no longer in the walk-in-filtered list
  useEffect(() => {
    if (!(isGuest || modeFromUrl === "walk_in")) return;
    if (!selectedPackageId) return;
    if (!selectablePackages.some((p) => p.id === selectedPackageId)) {
      setValue("package_id", "", { shouldValidate: true });
    }
  }, [isGuest, modeFromUrl, selectablePackages, selectedPackageId, setValue]);

  useEffect(() => {
    if (bookingMode === "walk_in" || isGuest) {
      setBookingMonth(todayIso.slice(0, 7));
      setValue("event_date", todayIso, { shouldValidate: true });
    }
  }, [bookingMode, isGuest, todayIso, setValue]);

  useEffect(() => {
    const loadMonth = async () => {
      try {
        await syncMonthAvailability(bookingMonth);
        const slots = await getTimeSlots();
        const rows = await ensureMonthAvailability(bookingMonth, slots);
        setMonthAvailability(rows);
      } catch (err) {
        console.error(err);
      }
    };
    loadMonth();
    const unsubA = subscribeAvailability(loadMonth);
    const unsubB = subscribeBookings(loadMonth);
    return () => {
      unsubA();
      unsubB();
    };
  }, [bookingMonth]);

  useEffect(() => {
    setValue("time_slot", "");
  }, [selectedDate, setValue]);

  const sameDayOnly = isGuest || bookingMode === "walk_in";

  const handleSelectDate = (date) => {
    if (sameDayOnly && date !== todayIso) {
      Swal.fire({
        icon: "info",
        title: "Walk-in is same-day only",
        text: isGuest
          ? "Guest sessions are same-day only. Create a password later to book future dates."
          : "Please choose today’s date, or switch to a scheduled booking.",
      });
      return;
    }
    setValue("event_date", date, { shouldValidate: true });
    if (date.slice(0, 7) !== bookingMonth) setBookingMonth(date.slice(0, 7));
  };

  const toggleAddon = (name) => {
    setSelectedAddons((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const onSubmit = async (data) => {
    if (!user) return;
    if (!data.event_date || !data.time_slot) {
      Swal.fire({ icon: "warning", title: "Select date and time", text: "Pick an open date and available time slot." });
      return;
    }
    const isWalkIn = Boolean(isGuest || data.booking_mode === "walk_in");
    if (isWalkIn && data.event_date !== todayIso) {
      Swal.fire({ icon: "warning", title: "Walk-in must be today", text: "Same-day slots only for walk-in bookings." });
      return;
    }
    const pkg = packages.find((p) => p.id === data.package_id);
    if (isWalkIn && !pkg?.allows_walk_in) {
      Swal.fire({
        icon: "warning",
        title: "Package does not allow walk-in",
        text: "Choose a package with walk-in enabled, or ask the studio to turn it on.",
      });
      return;
    }

    setLoading(true);
    try {
      const available = await isSlotBookable(data.event_date, data.time_slot);
      if (!available) {
        throw new Error("That time slot is fully booked or closed. Please choose another.");
      }

      const addonRows = selectedAddons.map((name) => {
        const a = ADDONS_CATALOG.find((x) => x.name === name);
        return { name, price: a?.price || 0 };
      });

      // Guest walk-in: save contact on profile. Registered walk-in: phone/address only (don't overwrite login email).
      if (isGuest) {
        await updateProfile(user.id, {
          phone: data.contact_number,
          address: data.client_address,
          email: data.contact_email || undefined,
          full_name: profile?.full_name,
        });
      } else if (isWalkIn) {
        await updateProfile(user.id, {
          phone: data.contact_number,
          address: data.client_address,
          full_name: profile?.full_name,
        });
      }

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
        is_walk_in: isWalkIn,
        ...(isWalkIn
          ? {
              guest_snapshot: {
                full_name: profile?.full_name || "",
                email: data.contact_email || profile?.email || "",
                phone: data.contact_number || "",
                address: data.client_address || "",
                created_at: new Date().toISOString(),
              },
            }
          : {}),
      });

      Swal.fire({
        icon: "success",
        title: isWalkIn ? "Walk-in request submitted" : "Booking submitted",
        text: isWalkIn
          ? "The studio will confirm your walk-in after reviewing your details and payment."
          : "Upload payment proof next so the studio can confirm your booking.",
        timer: 2800,
        showConfirmButton: false,
      });

      navigate(`/client-bookings/${booking.id}`);
    } catch (err) {
      const msg = err.message?.includes("slot_full") || err.message?.includes("fully booked")
        ? "This time slot just became full. Please pick another date or time."
        : err.message;
      Swal.fire({ icon: "error", title: "Booking failed", text: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientLayout>
      <div className="max-w-6xl mx-auto w-full">
        <div className="mb-8 text-center">
          <h1 className="heading-serif text-4xl font-bold text-[#5B4636]">
            {isGuest || modeFromUrl === "walk_in" ? "Book a Walk-in" : "Book a Session"}
          </h1>
          <p className="mt-2 text-gray-500">
            {isGuest || modeFromUrl === "walk_in"
              ? "Only packages with walk-in enabled are listed. Same-day slots only — create a password later to return."
              : "Choose a package, pick an available date & time, then confirm your details."}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 space-y-5 shadow-sm">
            <h2 className="font-semibold text-[#5B4636] text-lg">1. Package</h2>
            {(isGuest || modeFromUrl === "walk_in") && selectablePackages.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="font-semibold">No walk-in packages available</p>
                <p className="mt-1 text-amber-800">
                  The studio has not enabled walk-in on any package yet. Ask staff to turn on walk-in for a package, or book as a full client later.
                </p>
              </div>
            ) : (
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">Select package</label>
                <select
                  {...register("package_id", { required: "Select a package" })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:border-[#A98B75] outline-none"
                >
                  <option value="">Select Package</option>
                  {selectablePackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ₱{Number(pkg.price).toLocaleString()}
                      {pkg.allows_walk_in ? " · Walk-in OK" : ""}
                    </option>
                  ))}
                </select>
                {errors.package_id && <p className="text-red-500 text-xs mt-1">{errors.package_id.message}</p>}
              </div>
            )}

            {selectedPackage && (
              <div className="grid md:grid-cols-2 gap-4">
                {selectedPackage.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-[#E8E1DA] aspect-[16/10]">
                    <img
                      src={getThumbnailUrl(selectedPackage.image_url, 640, 400)}
                      alt={selectedPackage.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#E8E1DA] bg-[#F8F6F3] aspect-[16/10] flex items-center justify-center text-sm text-gray-400">
                    No package image
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-[#5B4636] mb-2">Inclusions</p>
                  {inclusions.length ? (
                    <ul className="space-y-2">
                      {inclusions.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-0.5 w-4 h-4 rounded-full bg-[#A98B75]/15 text-[#A98B75] flex items-center justify-center flex-shrink-0">
                            <FaCheck className="text-[8px]" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">No inclusions listed yet.</p>
                  )}
                  {allowsWalkIn && (
                    <p className="mt-3 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
                      This package accepts same-day walk-ins.
                    </p>
                  )}
                </div>
              </div>
            )}

            {(isGuest || allowsWalkIn) && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Booking type</p>
                {isGuest ? (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <span className="block text-sm font-semibold text-sky-900">Walk-in (same day)</span>
                    <span className="block text-xs text-sky-800 mt-0.5">
                      Guest sessions book today only. Guest login lasts about 2 days — create a password to keep access. Booking records stay with the studio.
                    </span>
                    <input type="hidden" value="walk_in" {...register("booking_mode")} />
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[
                      { value: "scheduled", label: "Scheduled", hint: "Pick any open future date" },
                      { value: "walk_in", label: "Walk-in", hint: "Same-day session only" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`rounded-xl border px-4 py-3 cursor-pointer transition ${
                          bookingMode === opt.value
                            ? "border-[#A98B75] bg-[#A98B75]/10"
                            : "border-[#E8E1DA] hover:bg-[#F8F6F3]"
                        }`}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          {...register("booking_mode")}
                          className="sr-only"
                        />
                        <span className="block text-sm font-semibold text-[#5B4636]">{opt.label}</span>
                        <span className="block text-xs text-gray-500 mt-0.5">{opt.hint}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 space-y-4 shadow-sm">
            <h2 className="font-semibold text-[#5B4636] text-lg">
              {isGuest || bookingMode === "walk_in" ? "2. Contact information" : "2. Your details"}
            </h2>
            {(isGuest || bookingMode === "walk_in") && (
              <p className="text-sm text-sky-800 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3">
                Walk-in / guest — fill in your phone, email, and address so the studio can confirm your booking.
                {profile?.full_name ? (
                  <> Booking as <strong>{profile.full_name}</strong>.</>
                ) : null}
              </p>
            )}
            {(isGuest || bookingMode === "walk_in") && (
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  {...register("contact_email", {
                    required: "Email is required for walk-in bookings",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email",
                    },
                  })}
                  placeholder="you@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]"
                />
                {errors.contact_email && (
                  <p className="text-red-500 text-xs mt-1">{errors.contact_email.message}</p>
                )}
              </div>
            )}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Event Location</label>
              <input {...register("location", { required: "Enter location" })} placeholder="Studio or outdoor location" className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:border-[#A98B75]" />
              {errors.location && <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Contact Number <span className="text-red-500">*</span>
              </label>
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
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                {...register("client_address", { required: "Address is required" })}
                placeholder="Full address"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]"
              />
              {errors.client_address && <p className="text-red-500 text-xs mt-1">{errors.client_address.message}</p>}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">Session notes / preferences</label>
              <textarea rows={3} {...register("notes")} placeholder="Tell us about your vibe, outfit ideas, or special requests..." className="w-full border border-gray-300 rounded-xl px-4 py-3 resize-none outline-none focus:border-[#A98B75]" />
            </div>
          </div>

          {/* DentaBase-style calendar + details panel */}
          <div>
            <h2 className="font-semibold text-[#5B4636] text-lg mb-3">
              {isGuest || bookingMode === "walk_in" ? "3. Schedule (today)" : "3. Schedule"}
            </h2>
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 md:p-6 shadow-sm">
                <input type="hidden" {...register("event_date", { required: "Select a date" })} />
                <BookingDatePicker
                  month={bookingMonth}
                  onMonthChange={setBookingMonth}
                  availabilityByDate={availabilityByDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  minDate={sameDayOnly ? todayIso : null}
                  maxDate={sameDayOnly ? todayIso : null}
                  allSlotTimes={timeSlotTimes}
                />
                {errors.event_date && <p className="text-red-500 text-xs mt-2">{errors.event_date.message}</p>}
              </div>

              <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 md:p-6 shadow-sm flex flex-col">
                <h3 className="heading-serif text-2xl font-bold text-[#5B4636] mb-1">
                  {selectedDate ? "Session on this date" : "Pick a date"}
                </h3>
                {!selectedDate ? (
                  <p className="text-sm text-gray-400 mt-2 flex-1">
                    Available dates appear in blue. Fully booked dates appear in red. Select a date to view open time slots here.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-500 mb-1">{formatLongDate(selectedDate)}</p>
                    <p className="text-xs mb-4">
                      {dayStatus === "full" && <span className="text-red-600 font-medium">Fully booked</span>}
                      {dayStatus === "partial" && <span className="text-sky-700 font-medium">Limited slots available</span>}
                      {dayStatus === "available" && <span className="text-sky-700 font-medium">Open for booking</span>}
                      {dayStatus === "closed" && <span className="text-gray-500 font-medium">Closed</span>}
                      {sameDayOnly && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                          Walk-in
                        </span>
                      )}
                    </p>
                    <input type="hidden" {...register("time_slot", { required: "Select a time slot" })} />
                    <BookingTimeSlotPicker
                      slots={slotsForSelectedDate}
                      allSlotTimes={timeSlotTimes}
                      selectedSlot={selectedTimeSlot}
                      eventDate={selectedDate}
                      onSelect={(t) => setValue("time_slot", t, { shouldValidate: true })}
                      disabled={!selectedDate}
                    />
                    {errors.time_slot && <p className="text-red-500 text-xs mt-2">{errors.time_slot.message}</p>}
                    <p className="text-xs text-gray-400 mt-4">Typical session length depends on your package inclusions.</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6 shadow-sm">
            <h2 className="font-semibold text-[#5B4636] mb-4">4. Add-ons (optional)</h2>
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

          <div className="bg-[#5B4636] text-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-semibold mb-4">Booking summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between opacity-90">
                <span>Base service{selectedPackage ? `: ${selectedPackage.name}` : ""}</span>
                <span>₱{basePrice.toLocaleString()}</span>
              </div>
              {bookingMode === "walk_in" && (
                <div className="flex justify-between opacity-80">
                  <span>Booking type</span>
                  <span>Walk-in (same day)</span>
                </div>
              )}
              {selectedDate && (
                <div className="flex justify-between opacity-80">
                  <span>Date</span>
                  <span>{selectedDate}{selectedTimeSlot ? ` · ${selectedTimeSlot}` : ""}</span>
                </div>
              )}
              {selectedAddons.map((name) => {
                const a = ADDONS_CATALOG.find((x) => x.name === name);
                return (
                  <div key={name} className="flex justify-between opacity-80">
                    <span>{name}</span>
                    <span>+₱{(a?.price || 0).toLocaleString()}</span>
                  </div>
                );
              })}
              <div className="flex justify-between text-amber-100">
                <span>Reservation fee</span>
                <span>₱{RESERVATION_FEE.toLocaleString()}</span>
              </div>
              <p className="text-xs text-amber-100/90">
                A ₱{RESERVATION_FEE.toLocaleString()} reservation fee is added when you pay, on top of the package amount.
              </p>
              <div className="border-t border-white/20 pt-3 mt-3 flex justify-between text-lg font-bold">
                <span>Package total</span>
                <span>₱{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              !selectedDate ||
              !selectedTimeSlot ||
              ((isGuest || modeFromUrl === "walk_in") && selectablePackages.length === 0)
            }
            className="w-full py-3.5 rounded-full bg-[#A98B75] text-white font-semibold hover:bg-[#8a7260] transition disabled:opacity-50 shadow-lg shadow-[#A98B75]/20"
          >
            {loading ? "Submitting..." : bookingMode === "walk_in" ? "Book Walk-In Session" : "Book Appointment"}
          </button>
        </form>
      </div>
    </ClientLayout>
  );
}
