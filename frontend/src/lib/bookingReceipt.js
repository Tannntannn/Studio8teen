import { jsPDF } from "jspdf";
import QRCode from "qrcode";

function formatStatus(status) {
  return (status || "").replace(/_/g, " ");
}

export function getBookingVerifyUrl(booking) {
  if (!booking?.qr_token) return null;
  return `${window.location.origin}/verify/${booking.qr_token}`;
}

export function bookingHasQr(booking) {
  return Boolean(booking?.qr_token && ["confirmed", "completed"].includes(booking.status));
}

export async function generateBookingQrDataUrl(booking, size = 512) {
  const url = getBookingVerifyUrl(booking);
  if (!url) return null;
  return QRCode.toDataURL(url, { width: size, margin: 2, color: { dark: "#5B4636", light: "#FFFFFF" } });
}

/** Download QR code as PNG */
export async function downloadBookingQr(booking) {
  const dataUrl = await generateBookingQrDataUrl(booking, 800);
  if (!dataUrl) throw new Error("QR code is available only after payment is confirmed.");

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `studiobook-qr-${booking.id.slice(0, 8)}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function buildReceiptLines(booking, profile) {
  const pkg = booking.packages?.name || "Session";
  const price = Number(booking.packages?.price || 0);
  const addons = Array.isArray(booking.selected_addons) ? booking.selected_addons : [];
  const addonsTotal = Number(booking.addons_total || 0);
  const total = price + addonsTotal;
  const payment = booking.payments?.[0];

  return {
    pkg,
    price,
    addons,
    addonsTotal,
    total,
    payment,
    clientName: profile?.full_name || "—",
    email: profile?.email || "—",
    contact: booking.contact_number || profile?.phone || "—",
    address: booking.client_address || profile?.address || "—",
  };
}

/** Generate and download booking confirmation as PDF */
export async function downloadBookingReceipt(booking, profile) {
  const data = buildReceiptLines(booking, profile);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 20;
  let y = margin;

  const addLine = (text, opts = {}) => {
    const { size = 11, bold = false, color = [91, 70, 54] } = opts;
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    doc.text(text, margin, y);
    y += size * 0.45 + 3;
  };

  doc.setFillColor(169, 139, 117);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Studio 8Teen", margin, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Booking Confirmation Receipt", margin, 22);

  y = 38;
  addLine("Client Information", { size: 13, bold: true, color: [169, 139, 117] });
  addLine(`Name: ${data.clientName}`);
  addLine(`Email: ${data.email}`);
  addLine(`Contact: ${data.contact}`);
  const addressLines = doc.splitTextToSize(`Address: ${data.address}`, 170);
  doc.setFontSize(11);
  doc.setTextColor(91, 70, 54);
  doc.text(addressLines, margin, y);
  y += addressLines.length * 5 + 4;

  addLine("Session Details", { size: 13, bold: true, color: [169, 139, 117] });
  addLine(`Package: ${data.pkg}`);
  addLine(`Date: ${booking.event_date} at ${booking.time_slot}`);
  addLine(`Location: ${booking.location || "Studio"}`);
  addLine(`Status: ${formatStatus(booking.status)}`);

  y += 2;
  addLine("Payment Summary", { size: 13, bold: true, color: [169, 139, 117] });
  addLine(`Base price: ₱${data.price.toLocaleString()}`);
  data.addons.forEach((a) => {
    addLine(`${a.name}: +₱${Number(a.price || 0).toLocaleString()}`);
  });
  addLine(`Total: ₱${data.total.toLocaleString()}`, { bold: true, size: 12 });

  if (data.payment) {
    addLine(
      `Payment: ${data.payment.payment_type} — ₱${Number(data.payment.amount).toLocaleString()} (${data.payment.status})`
    );
  }

  addLine(`Booking ID: ${booking.id}`, { size: 9, color: [120, 120, 120] });

  if (bookingHasQr(booking)) {
    const verifyUrl = getBookingVerifyUrl(booking);
    const qrDataUrl = await generateBookingQrDataUrl(booking, 400);

    y += 6;
    addLine("Booking Verification QR", { size: 13, bold: true, color: [169, 139, 117] });

    const qrSize = 52;
    const qrX = (210 - qrSize) / 2;
    doc.setDrawColor(232, 225, 218);
    doc.setLineWidth(0.4);
    doc.roundedRect(qrX - 4, y - 2, qrSize + 8, qrSize + 18, 3, 3);

    doc.addImage(qrDataUrl, "PNG", qrX, y + 2, qrSize, qrSize);

    doc.setFontSize(9);
    doc.setTextColor(91, 70, 54);
    doc.text("Scan at the studio to verify this booking.", 105, y + qrSize + 12, { align: "center" });
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(verifyUrl, 105, y + qrSize + 17, { align: "center", maxWidth: 160 });

    y += qrSize + 24;
  } else {
    y += 4;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Verification QR will appear on your receipt after payment is confirmed.", margin, y);
    y += 8;
  }

  y = Math.max(y, 250);
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${new Date().toLocaleString()} · Studio 8Teen Photography Services`, margin, y);

  doc.save(`studiobook-receipt-${booking.id.slice(0, 8)}.pdf`);
}

export function extractQrToken(scannedText) {
  const text = (scannedText || "").trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const verifyIdx = parts.indexOf("verify");
    if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
      return parts[verifyIdx + 1];
    }
  } catch {
    /* plain token or partial path */
  }

  if (text.includes("/verify/")) {
    return text.split("/verify/").pop()?.split(/[?#]/)[0] || null;
  }

  return text;
}
