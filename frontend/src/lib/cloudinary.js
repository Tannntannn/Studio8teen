const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const isCloudinaryConfigured = Boolean(cloudName && uploadPreset);

export function getThumbnailUrl(url, width = 400, height = 400) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/w_${width},h_${height},c_fill,f_auto,q_auto/`);
}

export function getGalleryUrl(url, width = 800) {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/w_${width},f_auto,q_auto/`);
}

/** Vision analysis URL — insert transform after /upload/ (Cloudinary-safe). */
export function getVisionAnalysisUrl(url, width = 640) {
  if (!url || !url.includes("cloudinary.com")) return url;
  const transform = `w_${width},c_limit,f_auto,q_80`;
  if (url.includes(`/upload/${transform}/`)) return url;
  return url.replace("/upload/", `/upload/${transform}/`);
}

export async function uploadToCloudinary(file, folder = "studiobook") {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}

export const CLOUDINARY_FOLDERS = {
  publicPortfolio: "studiobook/public-portfolio",
  clientGallery: (clientId) => `studiobook/client-galleries/${clientId}`,
  paymentProof: (bookingId) => `studiobook/payment-proofs/${bookingId}`,
  cancellationProof: (bookingId) => `studiobook/cancellation-proofs/${bookingId}`,
  paymentQr: "studiobook/settings",
  moodBoard: (bookingId) => `studiobook/mood-boards/${bookingId}`,
  poses: "studiobook/poses",
  moodBoardThemes: "studiobook/mood-board-themes",
};
