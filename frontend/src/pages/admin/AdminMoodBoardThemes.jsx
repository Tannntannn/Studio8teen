import { useEffect, useState } from "react";
import { FaPalette, FaPlus, FaTrash, FaEdit, FaSave, FaMagic, FaTimes } from "react-icons/fa";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmModal from "../../components/ui/ConfirmModal";
import {
  getAllThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  asStringArray,
} from "../../services/moodBoardThemes";
import { uploadToCloudinary, CLOUDINARY_FOLDERS, getThumbnailUrl, getCutoutUrl } from "../../lib/cloudinary";
import { analyzeImageFiles, analyzeImageUrls } from "../../lib/imageAnalysis";
import { analyzeImagesWithVision, localColorSuggestionsOnly } from "../../services/imageVision";
import { normalizeEventType } from "../../lib/themeMatching";
import { EVENT_TYPES } from "../../lib/moodBoardOptions";
import {
  getMoodBoardCategoryLabels,
  groupedLabelsWithFallback,
  groupCategoryRows,
} from "../../services/moodBoardCategories";
import MoodBoardCategoryManager from "../../components/admin/MoodBoardCategoryManager";
import CategoryMultiSelect from "../../components/ui/CategoryMultiSelect";
import { asCategoryValues } from "../../services/moodBoardCategories";
import { colorNameFromHex, OUTFIT_CATEGORIES, PROP_CATEGORIES } from "../../lib/colorNames";
import Swal from "sweetalert2";

const EMPTY_FORM = {
  name: "",
  description: "",
  event_type: "",
  photography_style: [],
  mood: [],
  location_type: "",
  color_palette: [],
  tags: [],
  outfit_suggestions: "",
  prop_suggestions: "",
  lighting_style: "",
  editing_style: "",
  additional_notes: "",
  event_types: "",
  is_active: true,
  sort_order: 0,
};

function linesToArray(text) {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return asStringArray(arr).join("\n");
}

function guessCategory(text, categories, fallback) {
  const lower = String(text || "").toLowerCase();
  for (const cat of categories) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  // Keyword hints for outfits/props
  const hints = {
    Dress: ["dress", "gown", "barong"],
    Suit: ["suit", "tuxedo", "blazer"],
    Casual: ["casual", "jeans", "tee"],
    Formal: ["formal", "evening"],
    Traditional: ["filipiniana", "baro", "kimono", "traditional"],
    Accessories: ["hat", "bag", "jewelry", "veil", "accessory"],
    Footwear: ["shoe", "heel", "boot", "sneaker"],
    Floral: ["flower", "bouquet", "floral", "petal"],
    Furniture: ["chair", "sofa", "table", "furniture"],
    Lighting: ["lamp", "candle", "light", "chandelier"],
    Decor: ["decor", "vase", "frame", "ornament"],
    Backdrop: ["backdrop", "curtain", "arch"],
    Tableware: ["plate", "glass", "cup", "tableware"],
    Signage: ["sign", "banner", "letter"],
  };
  for (const cat of categories) {
    for (const word of hints[cat] || []) {
      if (lower.includes(word)) return cat;
    }
  }
  return fallback || categories[categories.length - 1] || "Other";
}

export default function AdminMoodBoardThemes() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentImages, setCurrentImages] = useState([]);
  const [currentOutfits, setCurrentOutfits] = useState([]);
  const [currentProps, setCurrentProps] = useState([]);
  const [outfitCategory, setOutfitCategory] = useState(OUTFIT_CATEGORIES[0]);
  const [propCategory, setPropCategory] = useState(PROP_CATEGORIES[0]);
  const [suggestionNote, setSuggestionNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [categoryLabels, setCategoryLabels] = useState(() =>
    groupedLabelsWithFallback(groupCategoryRows([]))
  );

  const load = () =>
    getAllThemes()
      .then(setThemes)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    getMoodBoardCategoryLabels()
      .then(setCategoryLabels)
      .catch(() => {});
  }, []);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const startCreate = () => {
    setEditingId("new");
    setForm(EMPTY_FORM);
    setCurrentImages([]);
    setCurrentOutfits([]);
    setCurrentProps([]);
    setOutfitCategory(OUTFIT_CATEGORIES[0]);
    setPropCategory(PROP_CATEGORIES[0]);
    setSuggestionNote("");
    setTagInput("");
  };

  const startEdit = (theme) => {
    setEditingId(theme.id);
    setCurrentImages(theme.inspiration_images || []);
    setCurrentOutfits(theme.outfit_images || []);
    setCurrentProps(theme.prop_images || []);
    setOutfitCategory(OUTFIT_CATEGORIES[0]);
    setPropCategory(PROP_CATEGORIES[0]);
    setSuggestionNote("");
    setTagInput("");
    setForm({
      name: theme.name,
      description: theme.description || "",
      event_type: theme.event_type || "",
      photography_style: asCategoryValues(theme.photography_style),
      mood: asCategoryValues(theme.mood),
      location_type: theme.location_type || "",
      color_palette: asStringArray(theme.color_palette),
      tags: asStringArray(theme.tags),
      outfit_suggestions: arrayToLines(theme.outfit_suggestions),
      prop_suggestions: arrayToLines(theme.prop_suggestions),
      lighting_style: theme.lighting_style || "",
      editing_style: theme.editing_style || "",
      additional_notes: theme.additional_notes || "",
      event_types: arrayToLines(theme.event_types),
      is_active: theme.is_active !== false,
      sort_order: theme.sort_order || 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCurrentImages([]);
    setCurrentOutfits([]);
    setCurrentProps([]);
    setSuggestionNote("");
    setTagInput("");
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    event_type: form.event_type.trim(),
    photography_style: form.photography_style,
    mood: form.mood,
    location_type: form.location_type.trim(),
    color_palette: form.color_palette,
    tags: form.tags,
    outfit_suggestions: linesToArray(form.outfit_suggestions),
    prop_suggestions: linesToArray(form.prop_suggestions),
    lighting_style: form.lighting_style.trim(),
    editing_style: form.editing_style.trim(),
    additional_notes: form.additional_notes.trim(),
    event_types: form.event_type.trim() ? [form.event_type.trim(), ...linesToArray(form.event_types)] : linesToArray(form.event_types),
    is_active: form.is_active,
    sort_order: Number(form.sort_order) || 0,
    inspiration_images: currentImages,
    outfit_images: currentOutfits,
    prop_images: currentProps,
  });

  // Merge AI suggestions into the form. Only fill fields the admin has left empty,
  // so manual edits are never overwritten. Palette/tags fill only when empty.
  const applySuggestions = (s, { overwrite = false } = {}) => {
    setForm((f) => {
      const next = { ...f };
      const fill = (key, value) => {
        if (!value) return;
        if (overwrite || !next[key] || !String(next[key]).trim()) next[key] = value;
      };
      const fillArray = (key, values) => {
        const list = asCategoryValues(values);
        if (!list.length) return;
        if (overwrite || !next[key]?.length) next[key] = list;
        else next[key] = [...new Set([...next[key], ...list])];
      };
      fill("name", f.name || s.theme);
      fillArray("mood", s.mood);
      fill("event_type", normalizeEventType(s.event_type) || s.event_type);
      fillArray("photography_style", s.photography_style);
      fill("location_type", s.location_type);
      fill("lighting_style", s.lighting_style);
      fill("editing_style", s.editing_style);

      // Description: prefer the AI-written description, otherwise synthesize one.
      if (overwrite || !next.description?.trim()) {
        const moodText = asCategoryValues(s.mood).join(" & ");
        const fallbackDesc = s.theme
          ? `${s.theme} theme${moodText ? ` with a ${moodText.toLowerCase()} feel` : ""}.`
          : "";
        next.description = (s.description || fallbackDesc || next.description || "").trim();
      }

      // Outfit / prop suggestions come back as arrays; only fill when empty.
      const fillLines = (key, arr) => {
        if (!arr?.length) return;
        if (overwrite || !next[key]?.trim()) next[key] = arr.join("\n");
      };
      fillLines("outfit_suggestions", s.outfit_suggestions);
      fillLines("prop_suggestions", s.prop_suggestions);

      if ((overwrite || !next.color_palette?.length) && s.color_palette?.length) {
        next.color_palette = s.color_palette;
      }
      // Tags: merge unique
      const tagMerge = new Set(overwrite ? [] : next.tags);
      (s.tags || []).forEach((t) => tagMerge.add(t));
      next.tags = [...tagMerge];
      return next;
    });
  };

  const runVisionAnalysis = async (urls, { overwrite = false, localPalette = null } = {}) => {
    const analyzeUrls = (urls || []).filter(Boolean).slice(-5);
    if (!analyzeUrls.length) return;

    if (localPalette) {
      applySuggestions(localColorSuggestionsOnly(localPalette, categoryLabels) || localPalette, { overwrite });
      setSuggestionNote("Quick suggestions applied — enhancing with AI...");
    } else {
      setSuggestionNote("Enhancing with AI...");
    }

    const result = await analyzeImagesWithVision(analyzeUrls, {
      onStatus: (msg) => setSuggestionNote(msg),
      categoryOptions: categoryLabels,
    });

    if (result?.suggestions) {
      const s = {
        ...result.suggestions,
        color_palette: result.suggestions.color_palette?.length
          ? result.suggestions.color_palette
          : localPalette?.color_palette || [],
      };
      applySuggestions(s, { overwrite });
      setSuggestionNote("AI analysis completed.");
      return;
    }

    if (localPalette) {
      setSuggestionNote(
        result?.meta?.error === "rate_limited"
          ? "AI is busy — quick local suggestions are applied. Try Re-analyze in a minute."
          : `AI unavailable — quick local suggestions are applied.${
              result?.meta?.detail ? ` (${String(result.meta.detail).slice(0, 120)})` : ""
            }`
      );
      return;
    }

    const colorsOnly = localColorSuggestionsOnly(localPalette, categoryLabels);
    if (colorsOnly) applySuggestions(colorsOnly, { overwrite });
    const detail = result?.meta?.detail;
    if (result?.meta?.error === "rate_limited") {
      setSuggestionNote(detail || "AI is busy. Wait 1–2 min and click Re-analyze.");
    } else {
      setSuggestionNote(detail ? `Analysis failed. ${detail}` : "Analysis failed — try Re-analyze.");
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setSuggestionNote("Reading colors from your images...");
    try {
      const local = await analyzeImageFiles(files, categoryLabels);
      if (local) {
        applySuggestions(localColorSuggestionsOnly(local, categoryLabels) || local, { overwrite: false });
        setSuggestionNote("Quick suggestions ready — uploading images...");
      }

      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { url, publicId } = await uploadToCloudinary(file, CLOUDINARY_FOLDERS.moodBoardThemes);
          return { id: crypto.randomUUID(), url, public_id: publicId, caption: "" };
        })
      );
      setCurrentImages((imgs) => [...imgs, ...uploaded]);
      setUploading(false);

      setAnalyzing(true);
      const uploadedUrls = uploaded.map((u) => u.url);
      await runVisionAnalysis(uploadedUrls, { localPalette: local });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Upload failed", text: err.message });
    } finally {
      setUploading(false);
      setAnalyzing(false);
      e.target.value = "";
    }
  };

  const handleReAnalyze = async (overwrite = false) => {
    const urls = currentImages.map((img) => img.url).filter(Boolean);
    if (!urls.length) {
      Swal.fire({ icon: "info", title: "No images", text: "Upload inspiration images first." });
      return;
    }
    setAnalyzing(true);
    try {
      const local = await analyzeImageUrls(urls, categoryLabels);
      if (local) {
        applySuggestions(localColorSuggestionsOnly(local, categoryLabels) || local, { overwrite });
      }
      await runVisionAnalysis(urls, { overwrite, localPalette: local });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Analysis failed", text: err.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRemoveImage = (imageId) => {
    setCurrentImages((imgs) => imgs.filter((img) => img.id !== imageId));
  };

  const uploadAssetImages = async (files, { kind, category }) => {
    const folder =
      kind === "outfit" ? CLOUDINARY_FOLDERS.moodBoardOutfits : CLOUDINARY_FOLDERS.moodBoardProps;
    const uploaded = await Promise.all(
      files.map(async (file) => {
        const { url, publicId, rawUrl } = await uploadToCloudinary(file, folder, {
          backgroundRemoval: true,
        });
        return {
          id: crypto.randomUUID(),
          url,
          raw_url: rawUrl,
          public_id: publicId,
          label: file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
          category,
          kind,
        };
      })
    );
    return uploaded;
  };

  const handleOutfitUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setSuggestionNote("Uploading outfits and removing backgrounds...");
    try {
      const uploaded = await uploadAssetImages(files, { kind: "outfit", category: outfitCategory });
      setCurrentOutfits((list) => [...list, ...uploaded]);
      setSuggestionNote("Outfits added — AI will refine categories when you re-analyze inspiration images.");
      // Light AI pass on outfit cutouts for category accuracy
      setAnalyzing(true);
      const result = await analyzeImagesWithVision(
        uploaded.map((u) => u.raw_url || u.url),
        { categoryOptions: categoryLabels }
      );
      if (result?.suggestions?.outfit_suggestions?.length) {
        const lines = result.suggestions.outfit_suggestions;
        setCurrentOutfits((list) =>
          list.map((item) => {
            const idx = uploaded.findIndex((u) => u.id === item.id);
            if (idx < 0) return item;
            return {
              ...item,
              label: lines[idx] || lines[0] || item.label,
              category: guessCategory(lines[idx] || lines.join(" "), OUTFIT_CATEGORIES, item.category),
            };
          })
        );
        applySuggestions(
          { outfit_suggestions: lines },
          { overwrite: false }
        );
      }
      setSuggestionNote("Outfit images ready (background removed when Cloudinary add-on is enabled).");
    } catch (err) {
      Swal.fire({ icon: "error", title: "Outfit upload failed", text: err.message });
    } finally {
      setUploading(false);
      setAnalyzing(false);
      e.target.value = "";
    }
  };

  const handlePropUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setSuggestionNote("Uploading props and removing backgrounds...");
    try {
      const uploaded = await uploadAssetImages(files, { kind: "prop", category: propCategory });
      setCurrentProps((list) => [...list, ...uploaded]);
      setAnalyzing(true);
      const result = await analyzeImagesWithVision(
        uploaded.map((u) => u.raw_url || u.url),
        { categoryOptions: categoryLabels }
      );
      if (result?.suggestions?.prop_suggestions?.length) {
        const lines = result.suggestions.prop_suggestions;
        setCurrentProps((list) =>
          list.map((item) => {
            const idx = uploaded.findIndex((u) => u.id === item.id);
            if (idx < 0) return item;
            return {
              ...item,
              label: lines[idx] || lines[0] || item.label,
              category: guessCategory(lines[idx] || lines.join(" "), PROP_CATEGORIES, item.category),
            };
          })
        );
        applySuggestions({ prop_suggestions: lines }, { overwrite: false });
      }
      setSuggestionNote("Prop images ready (background removed when Cloudinary add-on is enabled).");
    } catch (err) {
      Swal.fire({ icon: "error", title: "Prop upload failed", text: err.message });
    } finally {
      setUploading(false);
      setAnalyzing(false);
      e.target.value = "";
    }
  };

  const addTag = (raw) => {
    const value = (raw ?? tagInput).trim();
    if (!value) return;
    setForm((f) => (f.tags.includes(value) ? f : { ...f, tags: [...f.tags, value] }));
    setTagInput("");
  };

  const removeTag = (tag) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));

  const removeColor = (hex) => setForm((f) => ({ ...f, color_palette: f.color_palette.filter((c) => c !== hex) }));

  const addColor = () => {
    const hex = window.prompt("Add a hex color (e.g. #A98B75)");
    if (!hex) return;
    const clean = hex.trim().toUpperCase();
    if (!/^#([0-9A-F]{6}|[0-9A-F]{3})$/.test(clean)) {
      Swal.fire({ icon: "warning", title: "Invalid hex", text: "Use a format like #A98B75." });
      return;
    }
    setForm((f) => (f.color_palette.includes(clean) ? f : { ...f, color_palette: [...f.color_palette, clean] }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      Swal.fire({ icon: "warning", title: "Theme name is required" });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId === "new") {
        await createTheme(payload);
        Swal.fire({ icon: "success", title: "Theme created", timer: 1500, showConfirmButton: false });
      } else {
        await updateTheme(editingId, payload);
        Swal.fire({ icon: "success", title: "Theme updated", timer: 1500, showConfirmButton: false });
      }
      cancelEdit();
      load();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTheme(deleteTarget.id);
    setDeleteTarget(null);
    if (editingId === deleteTarget.id) cancelEdit();
    load();
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="heading-serif text-4xl font-bold text-[#5B4636] flex items-center gap-3">
              <FaPalette className="text-[#A98B75]" /> Mood Board Themes
            </h1>
            <p className="text-gray-500 mt-2">
              Upload inspiration images — suggestions are generated automatically. Review and save.
            </p>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium hover:bg-[#8a7260]"
          >
            <FaPlus size={12} /> New theme
          </button>
        </div>

        <MoodBoardCategoryManager
          onChange={(grouped) => setCategoryLabels(groupedLabelsWithFallback(grouped))}
        />

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {loading && <p className="text-gray-400 text-sm">Loading themes...</p>}
            {!loading && themes.length === 0 && (
              <div className="bg-white rounded-2xl border border-[#E8E1DA] p-8 text-center text-gray-400 text-sm">
                No themes yet. Create your first theme.
              </div>
            )}
            {themes.map((theme) => (
              <div
                key={theme.id}
                className={`bg-white rounded-2xl border p-4 transition ${
                  editingId === theme.id ? "border-[#A98B75] shadow-md" : "border-[#E8E1DA] hover:shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-semibold text-[#5B4636]">{theme.name}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{theme.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {asCategoryValues(theme.mood).map((m) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-[#A98B75]/10 text-[#A98B75]">{m}</span>
                      ))}
                      {asCategoryValues(theme.photography_style).map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8F6F3] text-gray-500 border border-[#E8E1DA]">{s}</span>
                      ))}
                      {theme.event_type && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F8F6F3] text-gray-500 border border-[#E8E1DA]">{theme.event_type}</span>}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {(theme.inspiration_images || []).length} scenes ·{" "}
                      {(theme.outfit_images || []).length} outfits ·{" "}
                      {(theme.prop_images || []).length} props · {theme.is_active ? "Active" : "Hidden"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEdit(theme)} className="p-2 text-[#A98B75] hover:bg-[#A98B75]/10 rounded-lg" title="Edit">
                      <FaEdit size={14} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(theme)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Delete">
                      <FaTrash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-3">
            {editingId ? (
              <form onSubmit={handleSave} className="bg-white rounded-2xl border border-[#E8E1DA] p-6 space-y-5">
                <h2 className="font-semibold text-[#5B4636] text-lg">
                  {editingId === "new" ? "Create theme" : "Edit theme"}
                </h2>

                {/* Inspiration images + auto analysis */}
                <div className="bg-[#F8F6F3] rounded-xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <label className="text-sm font-semibold text-[#5B4636] flex items-center gap-2">
                      <FaMagic className="text-[#A98B75]" size={13} /> Inspiration images
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {currentImages.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReAnalyze(false)}
                            disabled={analyzing || uploading}
                            className="px-3 py-2 rounded-xl border border-[#A98B75] text-[#A98B75] text-sm hover:bg-[#A98B75]/10 disabled:opacity-50"
                          >
                            {analyzing ? "Analyzing..." : "Re-analyze"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReAnalyze(true)}
                            disabled={analyzing || uploading}
                            className="px-3 py-2 rounded-xl border border-[#E8E1DA] text-gray-600 text-sm hover:bg-white disabled:opacity-50"
                            title="Overwrite all fields with fresh AI suggestions"
                          >
                            Re-analyze all fields
                          </button>
                        </>
                      )}
                      <label className={`inline-block px-4 py-2 rounded-xl bg-[#5B4636] text-white text-sm cursor-pointer hover:bg-[#4a3829] ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                        {analyzing ? "Analyzing..." : uploading ? "Uploading..." : "Upload & auto-suggest"}
                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  {suggestionNote && (
                    <p className="text-xs text-[#5B4636] bg-[#A98B75]/10 border border-[#A98B75]/20 rounded-lg px-3 py-2 mb-3">
                      {suggestionNote}
                    </p>
                  )}

                  {currentImages.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {currentImages.map((img) => (
                        <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group">
                          <img src={getThumbnailUrl(img.url, 200, 200)} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(img.id)}
                            className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Upload images to auto-generate suggestions below.</p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Theme name *</label>
                    <input
                      list="theme-name-options"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      required
                      placeholder="e.g. Rustic"
                      className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75]"
                    />
                    <datalist id="theme-name-options">
                      {categoryLabels.theme.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Event type</label>
                    <select value={form.event_type} onChange={(e) => setField("event_type", e.target.value)} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75] bg-white">
                      <option value="">Not specified</option>
                      {EVENT_TYPES.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <CategoryMultiSelect
                      label="Mood"
                      hint="Select one or more moods that fit this inspiration."
                      options={categoryLabels.mood}
                      value={form.mood}
                      onChange={(next) => setField("mood", next)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <CategoryMultiSelect
                      label="Photography style"
                      hint="Select one or more photography styles."
                      options={categoryLabels.photography_style}
                      value={form.photography_style}
                      onChange={(next) => setField("photography_style", next)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Location type</label>
                    <select
                      value={form.location_type}
                      onChange={(e) => setField("location_type", e.target.value)}
                      className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75] bg-white"
                    >
                      <option value="">Not specified</option>
                      {categoryLabels.location_type.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sort order</label>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e) => setField("sort_order", e.target.value)}
                      className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    rows={2}
                    className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]"
                  />
                </div>

                {/* Color palette chips */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Color palette</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.color_palette.map((hex) => (
                      <span key={hex} className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border border-[#E8E1DA] bg-white text-xs">
                        <span className="w-5 h-5 rounded-md border border-[#E8E1DA]" style={{ backgroundColor: hex }} />
                        <span className="font-medium text-[#5B4636]">{colorNameFromHex(hex)}</span>
                        <button type="button" onClick={() => removeColor(hex)} className="text-gray-400 hover:text-red-500">
                          <FaTimes size={10} />
                        </button>
                      </span>
                    ))}
                    <button type="button" onClick={addColor} className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-[#A98B75] text-[#A98B75] hover:bg-[#A98B75]/10">
                      + Add color
                    </button>
                    {form.color_palette.length === 0 && <span className="text-xs text-gray-400">No colors yet</span>}
                  </div>
                </div>

                {/* Outfit & prop cutout images for collage */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-[#F8F6F3] rounded-xl p-4">
                    <label className="block text-xs font-semibold text-[#5B4636] mb-2">Outfit cutouts</label>
                    <p className="text-[11px] text-gray-500 mb-2">
                      Shown in the center of the collage. Background is removed automatically when available.
                    </p>
                    <select
                      value={outfitCategory}
                      onChange={(e) => setOutfitCategory(e.target.value)}
                      className="w-full mb-2 border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#A98B75]"
                    >
                      {OUTFIT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <label className={`inline-block px-3 py-2 rounded-xl bg-[#5B4636] text-white text-xs cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      Upload outfits
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleOutfitUpload} disabled={uploading} />
                    </label>
                    {currentOutfits.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {currentOutfits.map((img) => (
                          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-white border border-[#E8E1DA] group">
                            <img src={getCutoutUrl(img.url, 200)} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.src = getThumbnailUrl(img.url, 200, 200); }} />
                            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">{img.category}</span>
                            <button
                              type="button"
                              onClick={() => setCurrentOutfits((list) => list.filter((x) => x.id !== img.id))}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-[#F8F6F3] rounded-xl p-4">
                    <label className="block text-xs font-semibold text-[#5B4636] mb-2">Prop cutouts</label>
                    <p className="text-[11px] text-gray-500 mb-2">
                      Layered with outfits in the collage center zone.
                    </p>
                    <select
                      value={propCategory}
                      onChange={(e) => setPropCategory(e.target.value)}
                      className="w-full mb-2 border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm bg-white outline-none focus:border-[#A98B75]"
                    >
                      {PROP_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <label className={`inline-block px-3 py-2 rounded-xl bg-[#5B4636] text-white text-xs cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                      Upload props
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handlePropUpload} disabled={uploading} />
                    </label>
                    {currentProps.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {currentProps.map((img) => (
                          <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden bg-white border border-[#E8E1DA] group">
                            <img src={getCutoutUrl(img.url, 200)} alt="" className="w-full h-full object-contain p-1" onError={(e) => { e.currentTarget.src = getThumbnailUrl(img.url, 200, 200); }} />
                            <span className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">{img.category}</span>
                            <button
                              type="button"
                              onClick={() => setCurrentProps((list) => list.filter((x) => x.id !== img.id))}
                              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600 text-white text-xs opacity-0 group-hover:opacity-100"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags chips */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Tags</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F8F6F3] border border-[#E8E1DA] text-xs text-[#5B4636]">
                        {tag}
                        <button type="button" onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-500">
                          <FaTimes size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add a tag and press Enter"
                      className="flex-1 border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm outline-none focus:border-[#A98B75]"
                    />
                    <button type="button" onClick={() => addTag()} className="px-4 py-2 rounded-xl border border-[#E8E1DA] text-sm">
                      Add
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Outfit suggestions (one per line)</label>
                    <textarea value={form.outfit_suggestions} onChange={(e) => setField("outfit_suggestions", e.target.value)} rows={4} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Prop suggestions (one per line)</label>
                    <textarea value={form.prop_suggestions} onChange={(e) => setField("prop_suggestions", e.target.value)} rows={4} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Lighting style</label>
                  <textarea value={form.lighting_style} onChange={(e) => setField("lighting_style", e.target.value)} rows={2} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Editing style</label>
                  <textarea value={form.editing_style} onChange={(e) => setField("editing_style", e.target.value)} rows={2} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Additional notes</label>
                  <textarea value={form.additional_notes} onChange={(e) => setField("additional_notes", e.target.value)} rows={2} className="w-full border border-[#E8E1DA] rounded-xl px-3 py-2 text-sm resize-none outline-none focus:border-[#A98B75]" />
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setField("is_active", e.target.checked)} className="accent-[#A98B75]" />
                  Active (visible to clients)
                </label>

                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A98B75] text-white text-sm font-medium disabled:opacity-50">
                    <FaSave size={12} /> {saving ? "Saving..." : "Save theme"}
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-5 py-2.5 rounded-xl border border-[#E8E1DA] text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-[#F8F6F3] rounded-2xl border border-dashed border-[#E8E1DA] p-12 text-center text-gray-400">
                Select a theme to edit or create a new one.
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this theme?"
        message={deleteTarget ? `"${deleteTarget.name}" will be permanently removed from the Mood Board Generator.` : ""}
        confirmLabel="Delete theme"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
