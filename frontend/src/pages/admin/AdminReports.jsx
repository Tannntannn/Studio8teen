import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import AdminLayout from "../../components/layout/AdminLayout";
import { getBookingStats, getAllBookings } from "../../services/bookings";
import { getRevenueStats } from "../../services/payments";
import { getRefundRequests } from "../../services/refunds";

const COLORS = ["#A98B75", "#5B4636", "#38bdf8", "#C4A882", "#8a7260", "#ef4444"];

function inRange(isoDate, from, to) {
  if (!isoDate) return false;
  if (from && isoDate < from) return false;
  if (to && isoDate > to) return false;
  return true;
}

function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatIso(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatIso(date);
}

const RANGE_OPTIONS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

function rangeBounds(id, today = new Date()) {
  const iso = formatIso(today);
  if (id === "today") return { from: iso, to: iso };
  if (id === "week") {
    const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
    const start = addDays(iso, mondayOffset);
    return { from: start, to: addDays(start, 6) };
  }
  if (id === "month") {
    return {
      from: formatIso(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: formatIso(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (id === "last-month") {
    return {
      from: formatIso(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: formatIso(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (id === "year") {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return { from: "", to: "" };
}

function formatPretty(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRangeLabel(from, to) {
  if (!from && !to) return "All event dates";
  if (from && to && from === to) return formatPretty(from);
  if (from && to) return `${formatPretty(from)} – ${formatPretty(to)}`;
  if (from) return `From ${formatPretty(from)}`;
  return `Through ${formatPretty(to)}`;
}

function bookingDate(booking) {
  return dateOnly(booking.event_date) || dateOnly(booking.created_at);
}

function paidOn(booking) {
  return verifiedPayments(booking).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function verifiedPayments(booking) {
  return (booking.payments || []).filter((payment) => payment.status === "verified");
}

function paymentChannel(payment) {
  const method = String(payment.payment_method || "").toLowerCase();
  const notes = String(payment.notes || "").toLowerCase();
  if (method === "cash" || notes.includes("cash")) return "Cash";
  if (method === "manual" || notes.includes("studio qr") || notes.includes("bank")) return "Studio QR / bank";
  if (method === "paymongo" || notes.includes("paymongo")) return "PayMongo";
  return "Other";
}

function ChangeBadge({ current, previous, label }) {
  const pct = !previous && !current
    ? 0
    : !previous
      ? 100
      : Math.round(((current - previous) / Math.abs(previous)) * 100);
  const up = pct >= 0;
  return (
    <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${up ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {up ? "+" : ""}{pct}% vs {label}
    </span>
  );
}

export default function AdminReports() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const openingRange = rangeBounds("month");
  const [rangeId, setRangeId] = useState("month");
  const [from, setFrom] = useState(openingRange.from);
  const [to, setTo] = useState(openingRange.to);

  useEffect(() => {
    getBookingStats().then(setStats).catch(console.error);
    getRevenueStats().then(setRevenue).catch(console.error);
    getAllBookings().then(setBookings).catch(console.error);
    getRefundRequests().then(setRefunds).catch(() => setRefunds([]));
  }, []);

  const filtered = useMemo(
    () => bookings.filter((booking) => inRange(bookingDate(booking), from || null, to || null)),
    [bookings, from, to]
  );
  const rangeLabel = formatRangeLabel(from, to);
  const spanDays = from && to
    ? Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000) + 1
    : null;

  const packageData = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      const name = b.packages?.name || "Unknown";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

  const statusData = useMemo(() => {
    const counts = {};
    filtered.forEach((b) => {
      const key = (b.status || "unknown").replace(/_/g, " ");
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const walkInSplit = useMemo(() => {
    const walkIn = filtered.filter((b) => b.is_walk_in).length;
    const scheduled = filtered.length - walkIn;
    return [
      { name: "Scheduled", value: scheduled },
      { name: "Walk-in", value: walkIn },
    ];
  }, [filtered]);

  const completed = filtered.filter((b) => b.status === "completed").length;
  const cancelled = filtered.filter((b) => b.status === "cancelled").length;
  const outcomeTotal = completed + cancelled;
  const completionRate = outcomeTotal ? Math.round((completed / outcomeTotal) * 100) : 0;
  const cancelRate = filtered.length ? Math.round((cancelled / filtered.length) * 100) : 0;

  const filteredRefunds = useMemo(() => {
    const ids = new Set(filtered.map((booking) => booking.id));
    return refunds.filter((item) => ids.has(item.booking_id));
  }, [refunds, filtered]);
  const refundPending = filteredRefunds.filter((item) => item.status === "pending").length;
  const refundedCount = filteredRefunds.filter((item) => item.status === "refunded").length;
  const refundRejected = filteredRefunds.filter((item) => item.status === "rejected").length;
  const refundedAmount = filteredRefunds
    .filter((item) => item.status === "refunded")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gross = filtered.reduce((sum, booking) => (
    sum + verifiedPayments(booking).reduce((paid, payment) => paid + Number(payment.amount || 0), 0)
  ), 0);
  const net = gross - refundedAmount;
  const refundRate = gross > 0 ? Math.round((refundedAmount / gross) * 100) : 0;
  const refundedByBooking = refunds.reduce((map, item) => {
    if (item.status !== "refunded") return map;
    map[item.booking_id] = (map[item.booking_id] || 0) + Number(item.amount || 0);
    return map;
  }, {});
  const retained = filtered.reduce((result, booking) => {
    const paid = verifiedPayments(booking).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const kept = paid - (refundedByBooking[booking.id] || 0);
    if (kept <= 0) return result;
    return { sum: result.sum + kept, count: result.count + 1 };
  }, { sum: 0, count: 0 });
  const aov = retained.count ? Math.round(retained.sum / retained.count) : 0;
  const compare = useMemo(() => {
    const today = new Date();
    let previousStart = "";
    let previousEnd = "";
    if (rangeId === "today") {
      const day = addDays(formatIso(today), -1);
      previousStart = day;
      previousEnd = day;
    } else if (rangeId === "week") {
      const current = rangeBounds("week", today);
      previousStart = addDays(current.from, -7);
      previousEnd = addDays(current.to, -7);
    } else if (rangeId === "month") {
      const last = rangeBounds("last-month", today);
      previousStart = last.from;
      previousEnd = last.to;
    } else if (rangeId === "last-month") {
      previousStart = formatIso(new Date(today.getFullYear(), today.getMonth() - 2, 1));
      previousEnd = formatIso(new Date(today.getFullYear(), today.getMonth() - 1, 0));
    } else if (rangeId === "year") {
      const year = today.getFullYear() - 1;
      previousStart = `${year}-01-01`;
      previousEnd = `${year}-12-31`;
    } else if (from && to) {
      const length = Math.max(1, Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000) + 1);
      previousEnd = addDays(from, -1);
      previousStart = addDays(previousEnd, -(length - 1));
    } else {
      return null;
    }
    const previousBookings = bookings.filter((booking) => inRange(bookingDate(booking), previousStart, previousEnd));
    const previousIds = new Set(previousBookings.map((booking) => booking.id));
    const previousGross = previousBookings.reduce((sum, booking) => sum + paidOn(booking), 0);
    const previousRefunded = refunds
      .filter((item) => item.status === "refunded" && previousIds.has(item.booking_id))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      previousGross,
      previousNet: previousGross - previousRefunded,
      label: formatRangeLabel(previousStart, previousEnd),
    };
  }, [bookings, refunds, from, to, rangeId]);
  const topPackages = packageData.slice(0, 3);
  const todayIso = formatIso(new Date());
  const confirmedCount = filtered.filter((booking) => booking.status === "confirmed").length;
  const awaitingCount = filtered.filter((booking) => booking.status === "awaiting_payment").length;
  const waitingConfirm = filtered.filter((booking) => booking.status === "pending").length;
  const upcomingCount = filtered.filter((booking) => (
    booking.event_date >= todayIso && !["cancelled", "completed"].includes(booking.status)
  )).length;
  const submittedPayments = filtered.flatMap((booking) => (
    (booking.payments || []).filter((payment) => payment.status === "submitted")
  ));
  const proofsAmount = submittedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingRefundAmount = filteredRefunds
    .filter((item) => item.status === "pending")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const mobilization = filtered
    .filter((booking) => booking.status !== "cancelled")
    .reduce((sum, booking) => sum + Number(booking.mobilization_fee || 0), 0);
  const eventCount = filtered.filter((booking) => booking.packages?.category === "event").length;

  const paymentMix = useMemo(() => {
    const counts = {};
    filtered.forEach((booking) => {
      verifiedPayments(booking).forEach((payment) => {
        const name = paymentChannel(payment);
        if (!counts[name]) counts[name] = { name, value: 0 };
        counts[name].value += Number(payment.amount || 0);
      });
    });
    return Object.values(counts).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const revenueTrend = useMemo(() => {
    const byDay = spanDays != null && spanDays <= 45;
    const bucket = (iso) => (byDay ? dateOnly(iso) : dateOnly(iso).slice(0, 7));
    const map = {};
    const touch = (key) => {
      if (!key) return;
      if (!map[key]) map[key] = { label: key, gross: 0, refunds: 0, net: 0 };
    };
    const eventByBooking = new Map(filtered.map((booking) => [booking.id, bookingDate(booking)]));
    filtered.forEach((booking) => {
      const key = bucket(bookingDate(booking));
      touch(key);
      if (map[key]) map[key].gross += paidOn(booking);
    });
    filteredRefunds.filter((item) => item.status === "refunded").forEach((item) => {
      const key = bucket(eventByBooking.get(item.booking_id));
      touch(key);
      if (map[key]) map[key].refunds += Number(item.amount || 0);
    });
    return Object.values(map)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((row) => ({ ...row, net: row.gross - row.refunds }));
  }, [filtered, filteredRefunds, spanDays]);

  const packageRevenue = useMemo(() => {
    const totals = {};
    filtered.forEach((booking) => {
      const name = booking.packages?.name || "Unknown";
      const paid = verifiedPayments(booking).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const refunded = refundedByBooking[booking.id] || 0;
      if (!totals[name]) totals[name] = { name, bookings: 0, revenue: 0, refunded: 0, net: 0 };
      totals[name].bookings += 1;
      totals[name].revenue += paid;
      totals[name].refunded += refunded;
      totals[name].net += paid - refunded;
    });
    return Object.values(totals).sort((a, b) => b.net - a.net);
  }, [filtered, refundedByBooking]);

  const exportCsv = () => {
    const rows = [
      ["Range", rangeLabel],
      ["From", from || ""],
      ["To", to || ""],
      [],
      ["Date", "Client", "Package", "Status", "Type", "Price"],
      ...filtered.map((b) => [
        b.event_date,
        b.profiles?.full_name || "",
        b.packages?.name || "",
        b.status || "",
        b.is_walk_in ? "Walk-in" : "Scheduled",
        Number(b.packages?.price || 0) + Number(b.addons_total || 0),
      ]),
      [],
      ["Revenue per package", "Bookings", "Gross", "Refunds", "Net"],
      ...packageRevenue.map((row) => [row.name, row.bookings, row.revenue, row.refunded, row.net]),
      [],
      ["Completed", completed],
      ["Cancelled", cancelled],
      ["Completion rate", `${completionRate}%`],
      ["Cancellation rate", `${cancelRate}%`],
      [],
      ["Refunds pending", refundPending],
      ["Refunds refunded", refundedCount],
      ["Refunds rejected", refundRejected],
      ["Refunded amount", refundedAmount],
      ["Pending refund amount", pendingRefundAmount],
      ["Gross revenue", gross],
      ["Net revenue", net],
      ["Refund rate", `${refundRate}%`],
      ["Average retained revenue", aov],
      ["Proofs waiting", submittedPayments.length],
      ["Proofs amount", proofsAmount],
      ["Awaiting payment", awaitingCount],
      ["Paid waiting confirm", waitingConfirm],
      ["Confirmed", confirmedCount],
      ["Upcoming", upcomingCount],
      ["Mobilization quoted", mobilization],
      ["Event bookings", eventCount],
      ["Studio bookings", filtered.length - eventCount],
      [],
      ["Top packages", "Bookings"],
      ...topPackages.map((row) => [row.name, row.value]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studiobook-insights-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="heading-serif text-3xl sm:text-4xl font-bold text-[#5B4636]">Insight Reports</h1>
            <p className="text-gray-500 mt-1 text-sm">Event dates · {rangeLabel}</p>
          </div>
          <button type="button" onClick={exportCsv} className="px-3 py-2 rounded-lg bg-[#5B4636] text-white text-sm">
            Export CSV
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                const bounds = rangeBounds(option.id);
                setRangeId(option.id);
                setFrom(bounds.from);
                setTo(bounds.to);
              }}
              className={`px-3 py-1.5 rounded-full text-sm ${rangeId === option.id ? "bg-[#5B4636] text-white" : "bg-white border border-[#E8E1DA] text-[#5B4636]"}`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRangeId("custom")}
            className={`px-3 py-1.5 rounded-full text-sm ${rangeId === "custom" ? "bg-[#5B4636] text-white" : "bg-white border border-[#E8E1DA] text-[#5B4636]"}`}
          >
            Custom
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2 mb-8">
          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setRangeId("custom");
                setFrom(event.target.value);
              }}
              className="border border-[#E8E1DA] rounded-lg px-2 py-1.5 text-sm max-w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-gray-400 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setRangeId("custom");
                setTo(event.target.value);
              }}
              className="border border-[#E8E1DA] rounded-lg px-2 py-1.5 text-sm max-w-full"
            />
          </div>
          <p className="text-xs text-gray-400 pb-2">Payments and refunds follow the bookings in this event-date range.</p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Gross revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-[#5B4636] break-words">₱{gross.toLocaleString()}</p>
            {compare && <ChangeBadge current={gross} previous={compare.previousGross} label={compare.label} />}
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Net revenue</p>
            <p className="text-xl sm:text-2xl font-bold text-[#5B4636] break-words">₱{net.toLocaleString()}</p>
            {compare && <ChangeBadge current={net} previous={compare.previousNet} label={compare.label} />}
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Total refunds</p>
            <p className="text-xl sm:text-2xl font-bold text-[#5B4636] break-words">₱{refundedAmount.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-2">{refundedCount} refunded</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Refund rate</p>
            <p className="text-2xl font-bold text-[#5B4636]">{refundRate}%</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Avg retained revenue</p>
            <p className="text-2xl font-bold text-[#5B4636]">₱{aov.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Bookings</p>
            <p className="text-2xl font-bold text-[#5B4636]">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Cancellation rate</p>
            <p className="text-2xl font-bold text-[#5B4636]">{cancelRate}%</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Walk-ins</p>
            <p className="text-2xl font-bold text-[#5B4636]">{walkInSplit[1]?.value || 0}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Proofs to verify</p>
            <p className="text-2xl font-bold text-[#5B4636]">{submittedPayments.length}</p>
            <p className="text-xs text-gray-400 mt-2">₱{proofsAmount.toLocaleString()} waiting</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Refunds to send</p>
            <p className="text-2xl font-bold text-[#5B4636]">{refundPending}</p>
            <p className="text-xs text-gray-400 mt-2">₱{pendingRefundAmount.toLocaleString()} pending</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Awaiting payment</p>
            <p className="text-2xl font-bold text-[#5B4636]">{awaitingCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Paid, waiting confirm</p>
            <p className="text-2xl font-bold text-[#5B4636]">{waitingConfirm}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-[#5B4636]">{confirmedCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Upcoming in range</p>
            <p className="text-2xl font-bold text-[#5B4636]">{upcomingCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Mobilization quoted</p>
            <p className="text-2xl font-bold text-[#5B4636] break-words">₱{mobilization.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-2">On bookings that are not cancelled</p>
          </div>
          <div className="bg-white rounded-xl border border-[#E8E1DA] p-4">
            <p className="text-sm text-gray-500">Event / studio</p>
            <p className="text-2xl font-bold text-[#5B4636]">{eventCount} / {filtered.length - eventCount}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 lg:col-span-2">
            <h3 className="font-semibold text-[#5B4636] mb-3">Revenue per package · {rangeLabel}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-[#E8E1DA]">
                    <th className="py-2 pr-3">Package</th>
                    <th className="py-2 pr-3">Bookings</th>
                    <th className="py-2 pr-3">Gross</th>
                    <th className="py-2 pr-3">Refunds</th>
                    <th className="py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {packageRevenue.map((row) => (
                    <tr key={row.name} className="border-b border-[#F8F6F3]">
                      <td className="py-2.5 pr-3">{row.name}</td>
                      <td className="py-2.5 pr-3">{row.bookings}</td>
                      <td className="py-2.5 pr-3">₱{row.revenue.toLocaleString()}</td>
                      <td className="py-2.5 pr-3">₱{row.refunded.toLocaleString()}</td>
                      <td className="py-2.5">₱{row.net.toLocaleString()}</td>
                    </tr>
                  ))}
                  {!packageRevenue.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-gray-400">No bookings in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-[#5B4636]">How clients paid</h3>
              {paymentMix.map((row) => (
                <p key={row.name} className="text-sm text-gray-500 mt-2 flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="font-semibold text-[#5B4636]">₱{row.value.toLocaleString()}</span>
                </p>
              ))}
              {!paymentMix.length && <p className="text-sm text-gray-400 mt-2">No verified payments in this range.</p>}
            </div>
            <div className="border-t border-[#E8E1DA] pt-4">
              <h3 className="font-semibold text-[#5B4636]">Finished bookings</h3>
              <p className="text-sm text-gray-500 mt-2">{completed} completed · {cancelled} cancelled</p>
              <p className="text-sm text-[#5B4636] mt-1">{completionRate}% of finished bookings were completed</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-4 sm:p-6 min-w-0 overflow-hidden">
            <h3 className="font-semibold mb-4 text-[#5B4636]">
              {spanDays != null && spanDays <= 45 ? "Money by event day" : "Money by month"} · {rangeLabel}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1DA" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis width={36} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="gross" name="Gross" stroke="#A98B75" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="net" name="Net" stroke="#5B4636" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-4 sm:p-6 min-w-0 overflow-hidden">
            <h3 className="font-semibold mb-3 text-[#5B4636]">Top packages</h3>
            <ol className="mb-4 space-y-2">
              {topPackages.map((row, index) => (
                <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[#5B4636]"><span className="text-gray-400 mr-2">{index + 1}</span>{row.name}</span>
                  <span className="font-semibold text-[#5B4636]">{row.value}</span>
                </li>
              ))}
              {!topPackages.length && <li className="text-sm text-gray-400">No bookings in this range.</li>}
            </ol>
            <h3 className="font-semibold mb-4 text-[#5B4636]">Popular packages</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={packageData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={48} />
                <YAxis width={28} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#A98B75" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-4 sm:p-6 min-w-0 overflow-hidden">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Bookings by status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData.length ? statusData : [{ name: "None", value: 1 }]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {(statusData.length ? statusData : [{ name: "None" }]).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E1DA] p-4 sm:p-6 min-w-0 overflow-hidden">
            <h3 className="font-semibold mb-4 text-[#5B4636]">Scheduled vs walk-in</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={walkInSplit} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {walkInSplit.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 mt-2 text-center">
              All-time {stats?.total ?? 0} bookings · net ₱{Number(revenue?.net_revenue || 0).toLocaleString()} · pending ₱{Number(revenue?.pending || 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E1DA] p-6">
          <h3 className="font-semibold mb-4 text-[#5B4636]">Recent bookings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-[#E8E1DA]">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Package</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 12).map((b) => {
                  const paid = verifiedPayments(b).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
                  return (
                    <tr key={b.id} className="border-b border-[#F8F6F3]">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{b.event_date}</td>
                      <td className="py-2.5 pr-3">{b.profiles?.full_name || "—"}</td>
                      <td className="py-2.5 pr-3">{b.packages?.name || "—"}</td>
                      <td className="py-2.5 pr-3">{b.is_walk_in ? "Walk-in" : "Scheduled"}</td>
                      <td className="py-2.5 pr-3">₱{paid.toLocaleString()}</td>
                      <td className="py-2.5 capitalize">{(b.status || "").replace(/_/g, " ")}</td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-400">No bookings in this range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
