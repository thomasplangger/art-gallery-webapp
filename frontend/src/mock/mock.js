const LS_KEY_ARTWORKS = "artworks_v3";
const LS_KEY_CATEGORIES = "categories_v1";
const LS_KEY_MEDIUMS = "medium_options_v1";
const LS_KEY_DIM_PRESETS = "dimension_presets_v1";

export const DEFAULT_CATEGORIES = ["painting", "sketch", "digital", "print"];
export const DEFAULT_STATUS = ["available", "reserved", "sold"];

export const DEFAULT_MEDIUMS = [
  "Oil on canvas",
  "Graphite on paper",
  "Digital print",
  "Giclée print",
];

export const DEFAULT_DIMENSION_PRESETS = [
  { label: "21×29.7 cm (A4)", widthCm: 21, heightCm: 29.7 },
  { label: "30×40 cm", widthCm: 30, heightCm: 40 },
  { label: "40×60 cm", widthCm: 40, heightCm: 60 },
  { label: "60×80 cm", widthCm: 60, heightCm: 80 },
];

const sample = [
  {
    id: crypto.randomUUID(),
    title: "Untitled No. 1",
    description: "A quiet exploration of light and texture.",
    priceCents: 32000,
    category: "painting",
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=60&auto=format&fit=crop&w=900&h=1200",
    year: 2022,
    medium: "Oil on canvas",
    dimensions: "60×80 cm",
    widthCm: 60,
    heightCm: 80,
    status: "available",
  },
  {
    id: crypto.randomUUID(),
    title: "Monochrome Study",
    description: "Study in lines and negative space.",
    priceCents: 9500,
    category: "sketch",
    image: "https://images.unsplash.com/photo-1526318472351-c75fcf070305?q=60&auto=format&fit=crop&w=900&h=1200",
    year: 2021,
    medium: "Graphite on paper",
    dimensions: "21×29.7 cm",
    widthCm: 21,
    heightCm: 29.7,
    status: "available",
  },
  {
    id: crypto.randomUUID(),
    title: "Digital Field",
    description: "Organic patterns generated digitally.",
    priceCents: 18500,
    category: "digital",
    image: "https://images.unsplash.com/photo-1544256718-3bcf237f3974?q=60&auto=format&fit=crop&w=900&h=1200",
    year: 2023,
    medium: "Digital print",
    dimensions: "40×60 cm",
    widthCm: 40,
    heightCm: 60,
    status: "reserved",
  },
  {
    id: crypto.randomUUID(),
    title: "Print Series A",
    description: "Editioned print with subtle gradients.",
    priceCents: 12000,
    category: "print",
    image: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=60&auto=format&fit=crop&w=900&h=1200",
    year: 2020,
    medium: "Giclée print",
    dimensions: "30×40 cm",
    widthCm: 30,
    heightCm: 40,
    status: "sold",
  },
];

export function getCategories() {
  const v = localStorage.getItem(LS_KEY_CATEGORIES);
  return v ? JSON.parse(v) : DEFAULT_CATEGORIES;
}

export function saveCategories(cats) {
  localStorage.setItem(LS_KEY_CATEGORIES, JSON.stringify(cats));
}

export function getMediumOptions() {
  const v = localStorage.getItem(LS_KEY_MEDIUMS);
  return v ? JSON.parse(v) : DEFAULT_MEDIUMS;
}

export function saveMediumOptions(items) {
  localStorage.setItem(LS_KEY_MEDIUMS, JSON.stringify(items));
}

export function getDimensionPresets() {
  const v = localStorage.getItem(LS_KEY_DIM_PRESETS);
  return v ? JSON.parse(v) : DEFAULT_DIMENSION_PRESETS;
}

export function saveDimensionPresets(items) {
  localStorage.setItem(LS_KEY_DIM_PRESETS, JSON.stringify(items));
}

export function getArtworks() {
  const stored = localStorage.getItem(LS_KEY_ARTWORKS);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(LS_KEY_ARTWORKS, JSON.stringify(sample));
  return sample;
}

export function saveArtworks(items) {
  localStorage.setItem(LS_KEY_ARTWORKS, JSON.stringify(items));
}

export function euros(cents) {
  return (cents / 100).toFixed(2);
}

export function centsFromEuroStr(str) {
  const n = Number(String(str).replace(/,/g, "."));
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function areaCm2(w, h) {
  if (!w || !h) return 0;
  return Number(w) * Number(h);
}