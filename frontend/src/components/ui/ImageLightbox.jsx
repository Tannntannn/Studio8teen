import { useEffect } from "react";
import { FaChevronLeft, FaChevronRight, FaTimes, FaDownload } from "react-icons/fa";

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export default function ImageLightbox({ images, index, onClose, onNavigate, meta, showDownload = true }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNavigate]);

  if (index == null || !images[index]) return null;

  const current = images[index];
  const imageUrl = current.url || current.cloudinary_url;

  const handleDownload = (e) => {
    e.stopPropagation();
    const name = (current.caption || current.title || `photo-${index + 1}`).replace(/[^\w.-]+/g, "-");
    downloadImage(imageUrl, `${name}.jpg`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#5B4636]/90 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
        aria-label="Close"
      >
        <FaTimes />
      </button>

      {showDownload && (
        <button
          type="button"
          onClick={handleDownload}
          className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          aria-label="Download"
        >
          <FaDownload size={14} />
        </button>
      )}

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          aria-label="Previous"
        >
          <FaChevronLeft />
        </button>
      )}

      {index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"
          aria-label="Next"
        >
          <FaChevronRight />
        </button>
      )}

      <div className="max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={imageUrl}
          alt={current.caption || current.title || "Gallery"}
          className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl"
        />
        {(meta || current.caption || current.created_at) && (
          <div className="mt-4 text-center text-white/90 text-sm">
            {meta}
            {current.created_at && (
              <p className="text-white/60 text-xs mt-1">
                {new Date(current.created_at).toLocaleString()}
              </p>
            )}
          </div>
        )}
        <p className="text-white/50 text-xs mt-2">{index + 1} / {images.length}</p>
      </div>
    </div>
  );
}
