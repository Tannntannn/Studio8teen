import { useEffect, useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import {
  addMoodBoardCategory,
  deleteMoodBoardCategory,
  getMoodBoardCategories,
  groupCategoryRows,
  MOOD_BOARD_CATEGORY_META,
} from "../../services/moodBoardCategories";

export default function MoodBoardCategoryManager({ onChange }) {
  const [grouped, setGrouped] = useState(() => groupCategoryRows([]));
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({ theme: "", mood: "", location_type: "", photography_style: "" });
  const [savingType, setSavingType] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await getMoodBoardCategories();
      const next = groupCategoryRows(rows);
      setGrouped(next);
      onChange?.(next);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not load categories", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (categoryType) => {
    const label = inputs[categoryType]?.trim();
    if (!label) return;
    setSavingType(categoryType);
    try {
      await addMoodBoardCategory(categoryType, label);
      setInputs((prev) => ({ ...prev, [categoryType]: "" }));
      await load();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not add", text: err.message });
    } finally {
      setSavingType(null);
    }
  };

  const handleDelete = async (item) => {
    const { isConfirmed } = await Swal.fire({
      title: `Remove "${item.label}"?`,
      text: "This option will disappear from client mood board dropdowns.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#c0392b",
    });
    if (!isConfirmed) return;
    try {
      await deleteMoodBoardCategory(item.id);
      await load();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not remove", text: err.message });
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-[#E8E1DA] p-6 mb-8">
      <h2 className="font-semibold text-[#5B4636] text-lg mb-1">Mood board categories</h2>
      <p className="text-sm text-gray-500 mb-6">
        Add or remove dropdown options. Changes apply to the client Mood Board Generator and theme editor.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Loading categories...</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(MOOD_BOARD_CATEGORY_META).map(([type, meta]) => (
            <div key={type} className="rounded-xl border border-[#E8E1DA] bg-[#F8F6F3] p-4">
              <h3 className="text-sm font-semibold text-[#5B4636] mb-3">{meta.title}</h3>
              <ul className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
                {(grouped[type] || []).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-2 bg-white rounded-lg px-2.5 py-1.5 text-sm text-[#5B4636] border border-[#E8E1DA]"
                  >
                    <span className="truncate">{item.label}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-red-400 hover:text-red-600 flex-shrink-0 p-1"
                      aria-label={`Remove ${item.label}`}
                    >
                      <FaTrash size={11} />
                    </button>
                  </li>
                ))}
                {!grouped[type]?.length && (
                  <li className="text-xs text-gray-400 italic px-1">No options yet</li>
                )}
              </ul>
              <div className="flex gap-1.5">
                <input
                  value={inputs[type]}
                  onChange={(e) => setInputs((prev) => ({ ...prev, [type]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd(type);
                    }
                  }}
                  placeholder={meta.addPlaceholder}
                  className="flex-1 min-w-0 border border-[#E8E1DA] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#A98B75] bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleAdd(type)}
                  disabled={savingType === type || !inputs[type]?.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-[#A98B75] text-white text-xs disabled:opacity-50"
                  aria-label={`Add ${meta.title}`}
                >
                  <FaPlus size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
