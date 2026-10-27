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
    });
  });
  return form;
}

export function enabledMobilizations(form) {
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
    }))
    .filter((row) => row.label.length >= 2);
  return [...presets, ...custom];
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

export function formToMobilizations(form, category) {
  if (category !== "event") return [];
  return enabledMobilizations(form);
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
