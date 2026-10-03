export const PAYMENT_PLATFORMS = [
  { id: "paymongo", label: "PayMongo" },
  { id: "gcash", label: "GCash" },
  { id: "maya", label: "Maya" },
  { id: "gotyme", label: "GoTyme" },
  { id: "maribank", label: "MariBank" },
  { id: "cash", label: "Cash" },
];

export const CASH_METHOD = {
  id: "cash",
  platform: "cash",
  label: "Cash",
  url: null,
};

export function normalizePaymentMethods(settings, { includeCash = false } = {}) {
  const methods = Array.isArray(settings?.payment_methods) ? settings.payment_methods : [];
  let active = methods.filter((m) => m?.url && m?.platform && !m.comingSoon && m.platform !== "cash");

  if (!active.length && settings?.payment_qr_url) {
    active = [
      {
        id: "legacy",
        platform: "gcash",
        label: "GCash / Bank",
        url: settings.payment_qr_url,
        public_id: settings.payment_qr_public_id,
      },
    ];
  }

  if (includeCash && !active.some((m) => m.platform === "cash" || m.id === "cash")) {
    active = [...active, CASH_METHOD];
  }

  return active;
}

export function platformLabel(platform) {
  return PAYMENT_PLATFORMS.find((p) => p.id === platform)?.label || platform || "Payment";
}

export function isCashMethod(method) {
  return method?.platform === "cash" || method?.id === "cash";
}
