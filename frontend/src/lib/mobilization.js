export const MOBILIZATION_TYPES = [
  {
    id: "van",
    label: "Van or closed SUV",
    detail: "An air-conditioned van or SUV keeps cameras and lights out of rain, dust, and rough travel.",
  },
  {
    id: "hard_case",
    label: "Hard-case rolling",
    detail: "Gear is packed in wheeled waterproof cases and rolled in from parking.",
  },
  {
    id: "technical_setup",
    label: "Technical setup",
    detail: "Lights, stands, and a photobooth or live-feed station are set up before guests arrive.",
  },
  {
    id: "backup_assistant",
    label: "Backup assistant",
    detail: "An assistant carries batteries, memory cards, and moves lights during the event.",
  },
  {
    id: "on_site_edit",
    label: "On-site editing runner",
    detail: "A runner takes cards to an editing station for a same-day slideshow or social posts.",
  },
];

export function newCustomMobilizationId() {
  const raw = globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `custom_${String(raw).replace(/-/g, "")}`;
}

export function emptyMobilizationForm() {
  return {
    presets: Object.fromEntries(MOBILIZATION_TYPES.map((type) => [type.id, { enabled: false, price: "" }])),
    custom: [],
  };
}

export function mobilizationsToForm(value) {
  const rows = Array.isArray(value) ? value : [];
  const form = emptyMobilizationForm();
  rows.forEach((row) => {
    const id = String(row?.id || "");
    if (form.presets[id]) {
      form.presets[id] = { enabled: true, price: row.price ?? "" };
      return;
    }
    const label = String(row?.label || "").trim();
    if (label.length < 2) return;
    form.custom.push({
      id: /^custom_[A-Za-z0-9]{8,64}$/.test(id) ? id : newCustomMobilizationId(),
      label,
      price: row.price ?? "",
      enabled: row.enabled !== false,
    });
  });
  return form;
}

export function storedMobilizations(form) {
  const presets = MOBILIZATION_TYPES
    .filter((type) => form?.presets?.[type.id]?.enabled)
    .map((type) => ({
      id: type.id,
      price: Math.max(0, Number(form.presets[type.id].price || 0) || 0),
    }));
  const custom = (Array.isArray(form?.custom) ? form.custom : [])
    .map((row) => ({
      id: /^custom_[A-Za-z0-9]{8,64}$/.test(String(row.id || "")) ? row.id : newCustomMobilizationId(),
      label: String(row.label || "").trim(),
      price: Math.max(0, Number(row.price || 0) || 0),
      enabled: row.enabled !== false,
    }))
    .filter((row) => row.label.length >= 2);
  return [...presets, ...custom];
}

export function enabledMobilizations(form) {
  return storedMobilizations(form).filter((item) => item.enabled !== false);
}

export function chargedMobilizations(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.enabled !== false);
}

export function mobilizationFormError(form) {
  const incomplete = (Array.isArray(form?.custom) ? form.custom : []).some((row) => {
    const label = String(row.label || "").trim();
    const price = String(row.price ?? "").trim();
    if (!label && !price) return false;
    return label.length < 2;
  });
  return incomplete ? "Each custom mobilization needs a name." : "";
}

export function bookingMobilizationForm(packageItems, bookingItems) {
  const catalog = mobilizationsToForm(packageItems);
  const saved = Array.isArray(bookingItems) ? bookingItems : [];
  if (!saved.length) return catalog;
  const picked = Object.fromEntries(saved.map((item) => [item.id, item]));
  const presets = Object.fromEntries(Object.entries(catalog.presets).map(([id, row]) => {
    const item = picked[id];
    if (!item) return [id, { ...row, enabled: false }];
    return [id, { enabled: item.enabled !== false, price: item.price ?? row.price }];
  }));
  const custom = catalog.custom.map((row) => {
    const item = picked[row.id];
    if (!item) return { ...row, enabled: false };
    return {
      ...row,
      label: String(item.label || row.label),
      price: item.price ?? row.price,
      enabled: item.enabled !== false,
    };
  });
  saved.forEach((item) => {
    if (presets[item.id] || custom.some((row) => row.id === item.id)) return;
    const label = String(item.label || "").trim();
    if (label.length < 2) return;
    custom.push({
      id: /^custom_[A-Za-z0-9]{8,64}$/.test(String(item.id || "")) ? item.id : newCustomMobilizationId(),
      label,
      price: item.price ?? "",
      enabled: item.enabled !== false,
    });
  });
  return { presets, custom };
}

export function formToMobilizations(form, category) {
  if (category !== "event") return [];
  return storedMobilizations(form);
}

export function mobilizationLabel(itemOrId) {
  if (itemOrId && typeof itemOrId === "object") {
    const custom = String(itemOrId.label || "").trim();
    if (custom) return custom;
    return MOBILIZATION_TYPES.find((type) => type.id === itemOrId.id)?.label || "Mobilization";
  }
  return MOBILIZATION_TYPES.find((type) => type.id === itemOrId)?.label || "Mobilization";
}

export function mobilizationTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item.price || 0), 0);
}
