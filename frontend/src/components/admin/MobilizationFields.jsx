import { MOBILIZATION_TYPES, newCustomMobilizationId } from "../../lib/mobilization";

export default function MobilizationFields({ value, onChange, disabled = false, hint }) {
  const presets = value?.presets || {};
  const custom = Array.isArray(value?.custom) ? value.custom : [];

  const setPreset = (id, patch) => {
    const row = presets[id] || { enabled: false, price: "" };
    onChange({
      ...value,
      presets: { ...presets, [id]: { ...row, ...patch } },
      custom,
    });
  };

  const setCustom = (index, patch) => {
    onChange({
      ...value,
      presets,
      custom: custom.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    });
  };

  return (
    <div className="rounded-xl border border-[#E8E1DA] p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-[#5B4636]">Mobilization</p>
        <p className="text-xs text-gray-500 mt-1">
          {hint || "Turn on a standard type or add your own, then set the fee. New bookings copy these amounts."}
        </p>
      </div>
      {MOBILIZATION_TYPES.map((type) => {
        const row = presets[type.id] || { enabled: false, price: "" };
        return (
          <div key={type.id} className="rounded-xl bg-[#F8F6F3] px-3 py-3">
            <label className="flex items-start gap-2 text-sm text-[#5B4636]">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(row.enabled)}
                disabled={disabled}
                onChange={(event) => setPreset(type.id, { enabled: event.target.checked })}
              />
              <span>
                <span className="font-medium">{type.label}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{type.detail}</span>
              </span>
            </label>
            {row.enabled && (
              <label className="block text-xs text-gray-500 mt-2 ml-6">
                Fee (₱)
                <input
                  type="number"
                  min="0"
                  value={row.price}
                  disabled={disabled}
                  onChange={(event) => setPreset(type.id, { price: event.target.value })}
                  className="mt-1 w-full border border-[#E8E1DA] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#A98B75] bg-white disabled:bg-white"
                />
              </label>
            )}
          </div>
        );
      })}
      {custom.map((row, index) => (
        <div key={row.id || index} className="rounded-xl bg-[#F8F6F3] px-3 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[#5B4636]">Custom option</p>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange({
                  ...value,
                  presets,
                  custom: custom.filter((_, rowIndex) => rowIndex !== index),
                })}
                className="text-xs text-red-500"
              >
                Remove
              </button>
            )}
          </div>
          <label className="block text-xs text-gray-500">
            Name
            <input
              type="text"
              maxLength={80}
              value={row.label}
              disabled={disabled}
              onChange={(event) => setCustom(index, { label: event.target.value })}
              placeholder="Example: Generator and cables"
              className="mt-1 w-full border border-[#E8E1DA] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#A98B75] bg-white disabled:bg-white"
            />
          </label>
          <label className="block text-xs text-gray-500">
            Fee (₱)
            <input
              type="number"
              min="0"
              value={row.price}
              disabled={disabled}
              onChange={(event) => setCustom(index, { price: event.target.value })}
              className="mt-1 w-full border border-[#E8E1DA] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#A98B75] bg-white disabled:bg-white"
            />
          </label>
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange({
            ...value,
            presets,
            custom: [...custom, { id: newCustomMobilizationId(), label: "", price: "" }],
          })}
          className="text-sm text-[#5B4636] underline"
        >
          Add custom mobilization
        </button>
      )}
    </div>
  );
}
