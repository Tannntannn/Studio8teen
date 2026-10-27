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

export function emptyMobilizationForm() {
  return Object.fromEntries(MOBILIZATION_TYPES.map((type) => [type.id, { enabled: false, price: "" }]));
}

export function mobilizationsToForm(value) {
  const rows = Array.isArray(value) ? value : [];
  const form = emptyMobilizationForm();
  rows.forEach((row) => {
    if (!form[row?.id]) return;
    form[row.id] = { enabled: true, price: row.price ?? "" };
  });
  return form;
}

export function enabledMobilizations(form) {
  return MOBILIZATION_TYPES
    .filter((type) => form?.[type.id]?.enabled)
    .map((type) => ({
      id: type.id,
      price: Math.max(0, Number(form[type.id].price || 0) || 0),
    }));
}

export function formToMobilizations(form, category) {
  if (category !== "event") return [];
  return enabledMobilizations(form);
}

export function mobilizationLabel(id) {
  return MOBILIZATION_TYPES.find((type) => type.id === id)?.label || "Mobilization";
}

export function mobilizationTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(item.price || 0), 0);
}
