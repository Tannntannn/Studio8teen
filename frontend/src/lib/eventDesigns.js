/**
 * Visual design presets per mood-board event type.
 * Covers come from named files in frontend/src/assets.
 */

import weddingCover from "../assets/wedding.jpg";
import birthdayCover from "../assets/Birtaday.jpg";
import debutCover from "../assets/debut.jpg";
import christeningCover from "../assets/christening.jpg";
import familyCover from "../assets/family.jpg";
import corporateCover from "../assets/Corporate.jpg";
import casualCover from "../assets/Casual portarait.jpg";
import formalCover from "../assets/formal.jpg";
import graduationCover from "../assets/Graduation.jpg";

export const EVENT_DESIGNS = {
  Wedding: {
    label: "Wedding",
    tagline: "Soft florals, ivory light, quiet romance",
    cover: weddingCover,
    accent: "#9A7B6A",
    ink: "#2C2420",
    ground:
      "radial-gradient(ellipse at 20% 10%, #fff9f5 0%, transparent 55%), linear-gradient(155deg, #fbf6f1 0%, #f3e6dc 48%, #e8d5c8 100%)",
    frameBg: "#fffcf8",
    frameFoot: "18%",
    sublineColor: "rgba(44,36,32,0.42)",
    chip: "bg-rose-50 text-rose-900 border-rose-100",
  },
  Birthday: {
    label: "Birthday",
    tagline: "Bright color, cake light, playful energy",
    cover: birthdayCover,
    accent: "#C45C3E",
    ink: "#2A1F18",
    ground:
      "radial-gradient(ellipse at 80% 0%, #fff5eb 0%, transparent 50%), linear-gradient(160deg, #fffaf4 0%, #fde8d4 45%, #f5c9a8 100%)",
    frameBg: "#fffefb",
    frameFoot: "16%",
    sublineColor: "rgba(42,31,24,0.45)",
    chip: "bg-orange-50 text-orange-900 border-orange-100",
  },
  Debut: {
    label: "Debut",
    tagline: "Champagne glow, soft glam, coming-of-age",
    cover: debutCover,
    accent: "#B08D6A",
    ink: "#3A2E26",
    ground:
      "radial-gradient(ellipse at 30% 20%, #fff8ef 0%, transparent 50%), linear-gradient(150deg, #fbf4ea 0%, #f0e0cc 50%, #e4c9a8 100%)",
    frameBg: "#fffcf6",
    frameFoot: "18%",
    sublineColor: "rgba(58,46,38,0.4)",
    chip: "bg-amber-50 text-amber-950 border-amber-100",
  },
  Graduation: {
    label: "Graduation",
    tagline: "Navy pride, gold trim, milestone calm",
    cover: graduationCover,
    accent: "#3D4F6F",
    ink: "#1C2433",
    ground:
      "radial-gradient(ellipse at 15% 0%, #eef2f7 0%, transparent 50%), linear-gradient(155deg, #f5f7fa 0%, #e4e9f0 50%, #cfd7e3 100%)",
    frameBg: "#f8fafc",
    frameFoot: "15%",
    sublineColor: "rgba(28,36,51,0.4)",
    chip: "bg-slate-100 text-slate-800 border-slate-200",
  },
  Christening: {
    label: "Christening",
    tagline: "Soft blues, white lace, gentle light",
    cover: christeningCover,
    accent: "#6B8FA3",
    ink: "#243038",
    ground:
      "radial-gradient(ellipse at 70% 10%, #f2f7fa 0%, transparent 50%), linear-gradient(155deg, #fafcfd 0%, #e8f0f4 50%, #d5e4eb 100%)",
    frameBg: "#fcfeff",
    frameFoot: "17%",
    sublineColor: "rgba(36,48,56,0.4)",
    chip: "bg-sky-50 text-sky-900 border-sky-100",
  },
  Family: {
    label: "Family",
    tagline: "Warm earth, natural light, togetherness",
    cover: familyCover,
    accent: "#7A6A4F",
    ink: "#2B251C",
    ground:
      "radial-gradient(ellipse at 25% 15%, #f7f3eb 0%, transparent 50%), linear-gradient(155deg, #faf7f1 0%, #ebe3d4 50%, #d9ceb8 100%)",
    frameBg: "#fffcf5",
    frameFoot: "17%",
    sublineColor: "rgba(43,37,28,0.42)",
    chip: "bg-stone-100 text-stone-800 border-stone-200",
  },
  Corporate: {
    label: "Corporate",
    tagline: "Clean slate, sharp lines, professional calm",
    cover: corporateCover,
    accent: "#4A5564",
    ink: "#1A1F26",
    ground:
      "radial-gradient(ellipse at 50% 0%, #f0f2f4 0%, transparent 55%), linear-gradient(160deg, #f7f8f9 0%, #e8ebef 50%, #d5dae1 100%)",
    frameBg: "#ffffff",
    frameFoot: "14%",
    sublineColor: "rgba(26,31,38,0.4)",
    chip: "bg-zinc-100 text-zinc-800 border-zinc-200",
  },
  "Casual Portrait": {
    label: "Casual Portrait",
    tagline: "Sunlit skin, easy poses, everyday warmth",
    cover: casualCover,
    accent: "#A67C5D",
    ink: "#2E241C",
    ground:
      "radial-gradient(ellipse at 40% 0%, #faf3eb 0%, transparent 50%), linear-gradient(155deg, #fbf6f0 0%, #f0e4d6 50%, #e2d0bc 100%)",
    frameBg: "#fffaf4",
    frameFoot: "16%",
    sublineColor: "rgba(46,36,28,0.42)",
    chip: "bg-[#F8F1EA] text-[#5B4636] border-[#E8E1DA]",
  },
  "Formal Portrait": {
    label: "Formal Portrait",
    tagline: "Classic black, cream paper, timeless polish",
    cover: formalCover,
    accent: "#5C534A",
    ink: "#14110F",
    ground:
      "radial-gradient(ellipse at 30% 10%, #f4f1ec 0%, transparent 50%), linear-gradient(155deg, #f7f5f1 0%, #e6e1d8 50%, #d2cbc0 100%)",
    frameBg: "#faf8f4",
    frameFoot: "18%",
    sublineColor: "rgba(20,17,15,0.4)",
    chip: "bg-neutral-100 text-neutral-800 border-neutral-200",
  },
};

const DEFAULT_DESIGN = {
  label: "Session",
  tagline: "Studio-curated inspiration",
  cover: casualCover,
  accent: "#A98B75",
  ink: "#5B4636",
  ground:
    "radial-gradient(ellipse at 25% 15%, #fffefb 0%, transparent 50%), linear-gradient(155deg, #fbf7f1 0%, #f1e9dd 50%, #e7ddd0 100%)",
  frameBg: "#fffcf7",
  frameFoot: "18%",
  sublineColor: "rgba(23,20,18,0.4)",
  chip: "bg-[#F8F6F3] text-[#5B4636] border-[#E8E1DA]",
};

export function getEventDesign(eventType) {
  if (!eventType) return DEFAULT_DESIGN;
  return EVENT_DESIGNS[eventType] || DEFAULT_DESIGN;
}
