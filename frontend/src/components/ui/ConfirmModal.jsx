import { useEffect } from "react";
import { FaExclamationTriangle } from "react-icons/fa";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-[#A98B75] hover:bg-[#8a7260] text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#5B4636]/40 backdrop-blur-sm"
      onClick={loading ? undefined : onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#E8E1DA] shadow-2xl overflow-hidden animate-[pageFadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                variant === "danger" ? "bg-red-50 text-red-600" : "bg-[#A98B75]/10 text-[#A98B75]"
              }`}
            >
              <FaExclamationTriangle size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-modal-title" className="heading-serif text-xl font-bold text-[#5B4636]">
                {title}
              </h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-[#F8F6F3] border-t border-[#E8E1DA]">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#E8E1DA] bg-white text-[#5B4636] text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50 ${confirmClass}`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
