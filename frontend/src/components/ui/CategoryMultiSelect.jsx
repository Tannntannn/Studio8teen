import { asCategoryValues } from "../../services/moodBoardCategories";

export default function CategoryMultiSelect({ label, hint, options, value, onChange, disabled }) {
  const selected = asCategoryValues(value);

  const toggle = (option) => {
    if (disabled) return;
    const next = selected.includes(option)
      ? selected.filter((v) => v !== option)
      : [...selected, option];
    onChange(next);
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {(options || []).map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                active
                  ? "bg-[#A98B75] text-white border-[#A98B75]"
                  : "bg-white text-[#5B4636] border-[#E8E1DA] hover:border-[#A98B75]"
              } disabled:opacity-50`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-2">
          Selected: {selected.join(", ")}
        </p>
      )}
    </div>
  );
}
