import React, { useEffect, useMemo, useState } from "react";
import { useI18n, getCategoryLabel } from "../i18n";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Card } from "../components/ui/card";
import { useToast } from "../hooks/use-toast";
import ArtworkCard from "../components/ArtworkCard";
import { centsFromEuroStr, areaCm2 } from "../mock/mock";
import { Plus, Search } from "lucide-react";
import { useAdmin } from "../context/AdminContext";
import { compressImage } from "../lib/idb";
import FilterBar from "../components/FilterBar";
import ArtworkDetail from "../components/ArtworkDetail";

import {
  uploadImageBlob,
  listArtworks,
  createArtwork,
  updateArtwork as apiUpdateArtwork,
  deleteArtwork as apiDeleteArtwork,
  igQueue,
  igQueueCarousel,
  generateAICaption,
} from "../lib/api";

import IGComposerPreview from "../components/IGComposerPreview";

const FIXED_CATEGORIES = ["Painting", "Sketch", "Print"];
const FIXED_MEDIA = ["Acrylic", "Pens", "Spray Can", "Watercolor", "Charcoal"];

function getMediumLabel(lang, key) {
  const map = {
    Acrylic: { en: "Acrylic", de: "Acryl" },
    Pens: { en: "Pens", de: "Stifte" },
    "Spray Can": { en: "Spray Can", de: "Spraydose" },
    Watercolor: { en: "Watercolor", de: "Aquarell" },
    Charcoal: { en: "Charcoal", de: "Kohle" },
  };
  const e = map[key];
  if (!e) return key;
  return lang === "de" ? e.de : e.en;
}

const PRESET_SIZES = [
  { label: "40x50",  w: 40,  h: 50 },
  { label: "50x50",  w: 50,  h: 50 },
  { label: "29x29",  w: 29,  h: 29 },
  { label: "50x70",  w: 50,  h: 70 },
  { label: "50x40",  w: 50,  h: 40 },
  { label: "78x58",  w: 78,  h: 58 },
  { label: "25x25",  w: 25,  h: 25 },
  { label: "100x80", w: 100, h: 80 },
  { label: "58x78",  w: 58,  h: 78 },
  { label: "80x30",  w: 80,  h: 30 },
  { label: "70x100", w: 70,  h: 100 },
  { label: "30x40",  w: 30,  h: 40 },
];

const YEAR_MAX = 2030;
const YEAR_MIN = 2020;
const CURRENT_YEAR = Math.min(new Date().getFullYear(), YEAR_MAX);

const HASHTAGS =
  "#art #painting #acrylicpainting #modernart #expressionism #artwork #artoftheday #artistsoninstagram #artgallery #creative #contemporaryart";

const TT = (t) => (key, fallback) => {
  try { const out = t(key); if (typeof out === "string" && out && out !== key) return out; } catch {}
  return fallback;
};

const IG_DEFAULTS = {
  background: "blur",
  bgColor: "#f3f4f6",
  gradientTop: "#f8fafc",
  gradientBottom: "#e5e7eb",
  enableFrame: true,
  frameColor: "#ffffff",
  framePadding: 44,
  frameRadius: 28,
  enableBorder: false,
  borderWidth: 1,
  borderColor: "#e5e7eb",
  imagePadding: 20,
  safeMargin: 60,
  shadow: true,
  tilt: 0,
  quality: 0.9,
};

const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

const norm = (s) => String(s || "").trim().toLowerCase();
const uniq = (arr) => Array.from(new Set(arr));
const parseMediums = (s) => {
  if (!s) return [];
  return uniq(String(s).split(/[;,|]+/).map((x) => x.trim()).filter(Boolean));
};
const labelForMedium = (lang, token, options = []) => {
  const hit = options.find((opt) => norm(opt) === norm(token));
  return hit ? getMediumLabel(lang, hit) : token;
};

export default function Gallery() {
  const { t, lang } = useI18n();
  const T = TT(t);
  const { toast } = useToast();
  const { isAdmin } = useAdmin();

  const [artworks, setArtworks] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [sort, setSort] = useState("priceAsc");

  const [cats] = useState(FIXED_CATEGORIES);
  const [mediumOptions, setMediumOptions] = useState(FIXED_MEDIA);

  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addCategory, setAddCategory] = useState(FIXED_CATEGORIES[0]);
  const [addCustomCat, setAddCustomCat] = useState("");
  const [addImageBlob, setAddImageBlob] = useState(null);
  const [addPreview, setAddPreview] = useState("");
  const [addYear, setAddYear] = useState(String(CURRENT_YEAR));

  const [addMediums, setAddMediums] = useState(new Set());
  const [addCustomMedium, setAddCustomMedium] = useState("");

  const [selectedDimPreset, setSelectedDimPreset] = useState(PRESET_SIZES[0].label);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const [addWidthCm, setAddWidthCm] = useState("");
  const [addHeightCm, setAddHeightCm] = useState("");
  const [addStatus, setAddStatus] = useState("available");
  const [addDescription, setAddDescription] = useState("");

  const [postToInstagram, setPostToInstagram] = useState(false);
  const [captionPreview, setCaptionPreview] = useState("");
  const [captionBusy, setCaptionBusy] = useState(false);

  const [igOpen, setIgOpen] = useState(false);
  const [igSettings, setIgSettings] = useState(IG_DEFAULTS);
  const [igBlob, setIgBlob] = useState(null);
  const [igPreviewUrl, setIgPreviewUrl] = useState("");
  const [igImages, setIgImages] = useState([]);

  const [advFilters, setAdvFilters] = useState({
    categories: new Set(),
    mediums: new Set(),
    availability: new Set(),
    priceRange: [0, 100000],
    yearRange: [YEAR_MIN, YEAR_MAX],
    areaRange: [0, 10000],
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const normalizeArt = (a) => ({ ...a, image: a.image || a.imageUrl || undefined });

  const refreshArtworks = async () => {
    try {
      const data = await listArtworks();
      setArtworks(Array.isArray(data) ? data.map(normalizeArt) : []);
    } catch {
      setArtworks([]);
    }
  };
  useEffect(() => { refreshArtworks(); }, []);

  const derived = useMemo(() => {
    const prices = artworks.map((a) => a.priceCents || 0);
    const years = artworks.map((a) => a.year).filter(Boolean);
    const areas = artworks.map((a) => areaCm2(a.widthCm, a.heightCm));
    return {
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 100000,
      yearMin: years.length ? Math.min(...years) : YEAR_MIN,
      yearMax: years.length ? Math.max(...years) : new Date().getFullYear(),
      areaMin: areas.length ? Math.min(...areas) : 0,
      areaMax: areas.length ? Math.max(...areas) : 10000,
    };
  }, [artworks]);

  const filtered = useMemo(() => {
    let list = [...artworks];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((a) => a.title.toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q));

    const catSet = advFilters.categories.size ? advFilters.categories : selectedCats;
    if (catSet.size > 0) list = list.filter((a) => catSet.has(a.category));

    if (advFilters.mediums.size > 0) {
      list = list.filter((a) => {
        const tokens = parseMediums(a.medium).map(norm);
        for (const wanted of advFilters.mediums) {
          if (tokens.includes(wanted)) return true;
        }
        return false;
      });
    }

    if (advFilters.availability.size > 0) list = list.filter((a) => advFilters.availability.has(a.status));

    list = list.filter((a) => (a.priceCents || 0) >= advFilters.priceRange[0] && (a.priceCents || 0) <= advFilters.priceRange[1]);
    list = list.filter((a) => {
      const y = a.year || 0;
      return y >= advFilters.yearRange[0] && y <= advFilters.yearRange[1];
    });
    list = list.filter((a) => {
      const area = areaCm2(a.widthCm, a.heightCm);
      return area >= advFilters.areaRange[0] && area <= advFilters.areaRange[1];
    });

    switch (sort) {
      case "priceDesc": list.sort((a, b) => b.priceCents - a.priceCents); break;
      case "categoryAZ": list.sort((a, b) => String(a.category).localeCompare(String(b.category))); break;
      case "nameAZ": list.sort((a, b) => a.title.localeCompare(b.title)); break;
      default: list.sort((a, b) => a.priceCents - b.priceCents);
    }
    return list;
  }, [artworks, query, selectedCats, sort, advFilters]);

  const toggleCat = (c) => {
    const next = new Set(selectedCats);
    next.has(c) ? next.delete(c) : next.add(c);
    setSelectedCats(next);
  };

  const toggleMediumChip = (m) => {
    const n = norm(m);
    const nextSet = new Set(advFilters.mediums);
    nextSet.has(n) ? nextSet.delete(n) : nextSet.add(n);
    setAdvFilters({ ...advFilters, mediums: nextSet });
  };

  const selectedPreset = useMemo(
    () => PRESET_SIZES.find((p) => p.label === selectedDimPreset) || PRESET_SIZES[0],
    [selectedDimPreset]
  );
  const widthCmVal = useCustomSize ? parseInt(addWidthCm || "0", 10) : selectedPreset.w;
  const heightCmVal = useCustomSize ? parseInt(addHeightCm || "0", 10) : selectedPreset.h;
  const dimensionsText = useCustomSize
    ? (widthCmVal && heightCmVal ? `${widthCmVal}x${heightCmVal} cm` : "")
    : `${selectedPreset.label} cm`;

  const buildCaption = () => {
    const title = (addTitle || "").trim();
    const desc = (addDescription || "").trim();
    return `${title}\n${desc}\n\n${HASHTAGS}`.trim();
  };
  useEffect(() => {
    setCaptionPreview(buildCaption());
  }, [addTitle, addYear, addDescription, selectedDimPreset, useCustomSize, addWidthCm, addHeightCm, lang]);

  const handleSave = async (updated) => {
    try {
      const payload = {
        title: updated.title,
        description: updated.description,
        priceCents: Number(updated.priceCents || 0),
        category: updated.category,
        imageUrl: updated.imageUrl || updated.image || undefined,
        year: updated.year ? Number(updated.year) : undefined,
        medium: updated.medium || undefined,
        dimensions: updated.dimensions || undefined,
        widthCm: updated.widthCm ? Number(updated.widthCm) : undefined,
        heightCm: updated.heightCm ? Number(updated.heightCm) : undefined,
        status: updated.status || "available",
      };
      await apiUpdateArtwork(updated.id, payload);
      await refreshArtworks();
      toast({ title: t("toast.saved") });
    } catch (e) {
      toast({ title: t("toast.error"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiDeleteArtwork(id);
      await refreshArtworks();
      toast({ title: t("toast.deleted") });
    } catch (e) {
      toast({ title: t("toast.error"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  const handleAdd = async () => {
    const finalCat =
      addCategory === "__other__" && addCustomCat.trim()
        ? addCustomCat.trim()
        : addCategory;

    const selected = Array.from(addMediums);
    const finalMediumsPretty = selected.map((tok) => {
      const hit = mediumOptions.find((m) => norm(m) === norm(tok));
      return hit || tok;
    });
    const finalMedium = finalMediumsPretty.join(", ");

    try {
      let extraImages = undefined;
      if (Array.isArray(igImages) && igImages.length === 2) {
        const [img1DataUrl, img2DataUrl] = igImages;
        const dataUrlToBlob = async (d) => (await fetch(d)).blob();
        const raw1 = await dataUrlToBlob(img1DataUrl);
        const raw2 = await dataUrlToBlob(img2DataUrl);
        const url1 = await uploadImageBlob(raw1, "ig-1.jpg");
        const url2 = await uploadImageBlob(raw2, "ig-2.jpg");
        extraImages = [url1, url2];
      }

      let imageUrl = undefined;
      if (addImageBlob) {
        const blob = await compressImage(addImageBlob, 1400, 0.82);
        imageUrl = await uploadImageBlob(blob, addImageBlob.name || "image.jpg");
      }

      const payload = {
        title: (addTitle || "").trim() || "Untitled",
        description: (addDescription || "").trim(),
        priceCents: centsFromEuroStr(addPrice || 0),
        category: finalCat,
        imageUrl,
        year: addYear ? Number(addYear) : undefined,
        dimensions: (dimensionsText || "").trim() || undefined,
        widthCm: addWidthCm ? Number(addWidthCm) : undefined,
        heightCm: addHeightCm ? Number(addHeightCm) : undefined,
        status: addStatus || "available",
        ...(extraImages ? { extraImages } : {}),
      };

      await createArtwork(payload);
      await refreshArtworks();

      if (postToInstagram) {
        if (!Array.isArray(extraImages) || extraImages.length !== 2) {
          toast({
            title: t("toast.error"),
            description: T("toast.igNeedsTwoImages", "Instagram carousel needs 2 images. Use “Preview IG Carousel…” and generate the AI image."),
            variant: "destructive",
          });
        } else {
          try {
            const caption = (captionPreview || buildCaption()).trim();
            await igQueueCarousel({ images: extraImages, caption });
          } catch (err) {
            toast({ title: t("toast.error"), description: String(err?.message || err || "Instagram posting failed"), variant: "destructive" });
          }
        }
      }

      finalMediumsPretty.forEach((m) => {
        if (!mediumOptions.find((x) => norm(x) === norm(m))) {
          setMediumOptions((prev) => [...prev, m]);
        }
      });

      setAddOpen(false);
      setAddTitle("");
      setAddPrice("");
      setAddCategory(FIXED_CATEGORIES[0]);
      setAddCustomCat("");

      setAddImageBlob(null);
      if (addPreview?.startsWith?.("blob:")) URL.revokeObjectURL(addPreview);
      setAddPreview("");

      setAddYear(String(CURRENT_YEAR));
      setAddMediums(new Set());
      setAddCustomMedium("");

      setUseCustomSize(false);
      setAddWidthCm("");
      setAddHeightCm("");
      setSelectedDimPreset(PRESET_SIZES[0].label);

      setAddStatus("available");
      setAddDescription("");

      if (igPreviewUrl?.startsWith?.("blob:")) URL.revokeObjectURL(igPreviewUrl);
      setIgPreviewUrl("");
      setIgImages([]);

      toast({ title: t("toast.added") });
    } catch (e) {
      toast({ title: t("toast.error"), description: String(e?.message || e), variant: "destructive" });
    }
  };

  const onFile = (file) => {
    if (!file) return;
    setAddImageBlob(file);
    const url = URL.createObjectURL(file);
    if (addPreview) URL.revokeObjectURL(addPreview);
    setAddPreview(url);
    if (igPreviewUrl?.startsWith?.("blob:")) URL.revokeObjectURL(igPreviewUrl);
    setIgBlob(null);
  };
  const onDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); };
  const openDetail = (item) => { setDetailItem(item); setDetailOpen(true); };

  const years = useMemo(() => {
    const arr = [];
    for (let y = YEAR_MAX; y >= YEAR_MIN; y--) arr.push(String(y));
    return arr;
  }, []);

  const mediumChipList = useMemo(() => {
    const fromDataTokens = artworks.flatMap((a) => parseMediums(a.medium));
    const union = uniq([...mediumOptions, ...fromDataTokens]);
    const byNorm = new Map();
    union.forEach((m) => {
      const n = norm(m);
      if (!byNorm.has(n)) byNorm.set(n, m);
    });
    return Array.from(byNorm.values());
  }, [artworks, mediumOptions]);

  const isAddMediumChecked = (m) => addMediums.has(norm(m));
  const toggleAddMedium = (m) => {
    const n = norm(m);
    const next = new Set(addMediums);
    next.has(n) ? next.delete(n) : next.add(n);
    setAddMediums(next);
  };
  const addCustomMediumNow = () => {
    const v = addCustomMedium.trim();
    if (!v) return;
    const n = norm(v);
    setAddMediums((prev) => new Set(prev).add(n));
    if (!mediumOptions.find((x) => norm(x) === n)) {
      setMediumOptions((prev) => [...prev, v]);
    }
    setAddCustomMedium("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold heading-serif">{t("app.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("nav.gallery")}</p>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t("search.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t("filters.sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priceAsc">{t("filters.priceAsc")}</SelectItem>
              <SelectItem value="priceDesc">{t("filters.priceDesc")}</SelectItem>
              <SelectItem value="categoryAZ">{t("filters.categoryAZ")}</SelectItem>
              <SelectItem value="nameAZ">{t("filters.nameAZ")}</SelectItem>
            </SelectContent>
          </Select>

          <FilterBar
            categories={cats}
            priceMin={derived.priceMin}
            priceMax={derived.priceMax}
            yearMin={derived.yearMin}
            yearMax={derived.yearMax}
            areaMin={derived.areaMin}
            areaMax={derived.areaMax}
            value={advFilters}
            onChange={setAdvFilters}
          />

          {isAdmin && (
            <Button onClick={() => setAddOpen((v) => !v)}>
              <Plus className="h-4 w-4 mr-2" /> {t("form.addNew")}
            </Button>
          )}
        </div>
      </div>
      <div className="mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">{t("filters.categories")}:</span>
          <button
            className={`text-sm px-2 py-1 rounded-full border ${selectedCats.size === 0 ? "bg-secondary text-foreground" : "hover:bg-secondary"}`}
            onClick={() => setSelectedCats(new Set())}
          >
            {t("filters.all")}
          </button>
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => toggleCat(c)}
              className={`text-sm px-2 py-1 rounded-full border transition-colors ${selectedCats.has(c) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              title={c}
            >
              {getCategoryLabel(lang, c)}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-1">{lang === "de" ? "Materialien:" : "Mediums:"}</span>
          <button
            className={`text-sm px-2 py-1 rounded-full border ${advFilters.mediums.size === 0 ? "bg-secondary text-foreground" : "hover:bg-secondary"}`}
            onClick={() => setAdvFilters({ ...advFilters, mediums: new Set() })}
          >
            {t("filters.all")}
          </button>
          {mediumChipList.map((m) => (
            <button
              key={m}
              onClick={() => toggleMediumChip(m)}
              className={`text-sm px-2 py-1 rounded-full border transition-colors ${advFilters.mediums.has(norm(m)) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
              title={m}
            >
              {labelForMedium(lang, m, mediumOptions)}
            </button>
          ))}
        </div>
      </div>

      {isAdmin && addOpen && (
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.name")}</label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder={t("form.name")} />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.price")}</label>
              <Input value={addPrice} onChange={(e) => setAddPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.category")}</label>
              <Select value={addCategory} onValueChange={setAddCategory}>
                <SelectTrigger><SelectValue placeholder={t("form.category")} /></SelectTrigger>
                <SelectContent>
                  {FIXED_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{getCategoryLabel(lang, c)}</SelectItem>
                  ))}
                  <SelectItem value="__other__">{lang === "de" ? "Eigene Eingabe…" : "Other…"}</SelectItem>
                </SelectContent>
              </Select>
              {addCategory === "__other__" && (
                <Input
                  className="mt-2"
                  placeholder={lang === "de" ? "Kategorie eingeben" : "Enter category"}
                  value={addCustomCat}
                  onChange={(e) => setAddCustomCat(e.target.value)}
                />
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{T("form.image", "Image")}</label>
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }} className="mt-2 border border-dashed rounded-md p-3 text-center text-sm text-muted-foreground">
                {addPreview ? <img src={addPreview} alt="preview" className="mx-auto max-h-40 object-contain" /> : <p>{T("form.dragDrop", "Drag & drop image here, or")}</p>}
                <label className="underline cursor-pointer">
                  {T("form.selectFile", "select a file")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                </label>
              </div>
              {addImageBlob && <div className="text-xs mt-1 opacity-70">{T("form.fileStaged", "File staged locally. It will upload when you click “Add”.")}</div>}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.year")}</label>
              <Select value={addYear} onValueChange={setAddYear}>
                <SelectTrigger><SelectValue placeholder={String(CURRENT_YEAR)} /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  {Array.from({length: YEAR_MAX - YEAR_MIN + 1}, (_,i) => String(YEAR_MAX - i)).map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{lang === "de" ? "Medium" : "Medium"}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {mediumOptions.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => toggleAddMedium(m)}
                    className={`text-sm px-2 py-1 rounded-full border transition-colors ${isAddMediumChecked(m) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                    title={m}
                  >
                    {getMediumLabel(lang, m)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  className="max-w-xs"
                  placeholder={lang === "de" ? "Eigenes Medium (z. B. Aquarell)" : "Custom medium (e.g. Watercolor)"}
                  value={addCustomMedium}
                  onChange={(e) => setAddCustomMedium(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMediumNow(); } }}
                />
                <Button type="button" variant="secondary" onClick={addCustomMediumNow}>
                  {lang === "de" ? "Hinzufügen" : "Add"}
                </Button>
              </div>
              {addMediums.size > 0 && (
                <div className="text-xs mt-1 text-muted-foreground">
                  {lang === "de" ? "Ausgewählt:" : "Selected:"}{" "}
                  {Array.from(addMediums).map((n) => labelForMedium(lang, n, mediumOptions)).join(", ")}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{T("form.dimensions", "Dimensions")}</label>
              <Select
                value={selectedDimPreset}
                onValueChange={(v) => { setSelectedDimPreset(v); setUseCustomSize(false); }}
                disabled={useCustomSize}
              >
                <SelectTrigger><SelectValue placeholder={T("form.chooseSize", "Choose size")} /></SelectTrigger>
                <SelectContent>
                  {PRESET_SIZES.map((p) => (<SelectItem key={p.label} value={p.label}>{p.label} cm</SelectItem>))}
                </SelectContent>
              </Select>

              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={useCustomSize} onChange={(e) => setUseCustomSize(e.target.checked)} /> {T("form.custom", "Custom")}
              </label>

              {useCustomSize && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Input value={addWidthCm} onChange={(e) => setAddWidthCm(e.target.value.replace(/[^\d]/g, ""))} placeholder={T("form.width", "width")} inputMode="numeric" pattern="\d*" />
                  <Input value={addHeightCm} onChange={(e) => setAddHeightCm(e.target.value.replace(/[^\d]/g, ""))} placeholder={T("form.height", "height")} inputMode="numeric" pattern="\d*" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.status")}</label>
              <Select value={addStatus} onValueChange={setAddStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{T("status.available", "Available")}</SelectItem>
                  <SelectItem value="reserved">{T("status.reserved", "Reserved")}</SelectItem>
                  <SelectItem value="sold">{T("status.sold", "Sold")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">{T("form.description", "Description for the Website")}</label>
              <textarea className="w-full border rounded-md p-2 text-sm bg-background" rows={4} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} />
            </div>
            <div className="md:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={postToInstagram} onChange={(e) => setPostToInstagram(e.target.checked)} />
                  {T("form.postInstagram", "Post on Instagram")}
                </label>

                <Button type="button" variant="secondary" size="sm" disabled={!addPreview && !addImageBlob} onClick={() => setIgOpen(true)}>
                  {T("form.previewIgPost", "Preview IG Carousel…")}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    try {
                      setCaptionBusy(true);
                      let imageUrlForAI = undefined;
                      let imageDataForAI = undefined;

                      if (igPreviewUrl?.startsWith?.("data:")) {
                        imageDataForAI = igPreviewUrl;
                      } else if (igPreviewUrl?.startsWith?.("http")) {
                        imageUrlForAI = igPreviewUrl;
                      } else if (addImageBlob) {
                        imageDataForAI = await blobToDataURL(addImageBlob);
                      }

                      const dimsText =
                        useCustomSize && addWidthCm && addHeightCm
                          ? `${addWidthCm}x${addHeightCm} cm`
                          : selectedDimPreset
                          ? `${selectedDimPreset} cm`
                          : undefined;

                      const mediumsPretty = Array.from(addMediums).map((n) => {
                        const hit = mediumOptions.find((m) => norm(m) === n);
                        return hit || n;
                      }).join(", ");

                      const aiCaption = await generateAICaption({
                        imageUrl: imageUrlForAI || undefined,
                        imageData: imageDataForAI || undefined,
                        title: addTitle,
                        year: addYear ? Number(addYear) : undefined,
                        dimensions: dimsText,
                        lang,
                      });

                      setCaptionPreview(aiCaption);
                      toast({ title: t("toast.captionReady") });
                    } catch (err) {
                      toast({ title: t("toast.aiCaptionError"), description: String(err?.message || err), variant: "destructive" });
                    } finally {
                      setCaptionBusy(false);
                    }
                  }}
                  variant="secondary"
                >
                  {captionBusy ? "…" : T("form.generateCaption", "Generate caption")}
                </Button>

                {Array.isArray(igImages) && igImages.length > 0 ? (
                  <div className="flex items-center gap-2">
                    {igImages.map((u, i) => (
                      <img key={i} src={u} alt={`ig preview ${i + 1}`} className="h-16 w-auto rounded-md border" />
                    ))}
                  </div>
                ) : (
                  igPreviewUrl && (
                    <img src={igPreviewUrl} alt="ig preview" className="h-16 w-auto rounded-md border" />
                  )
                )}
              </div>

              <label className="block text-xs uppercase tracking-wide text-muted-foreground mt-3">
                {T("form.captionPreview", "Instagram caption")}
              </label>
              <textarea
                className="w-full border rounded-md p-2 text-sm bg-background"
                rows={5}
                value={captionPreview}
                onChange={(e) => setCaptionPreview(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>{t("form.cancel")}</Button>
            <Button onClick={handleAdd}>{t("form.add")}</Button>
          </div>
        </Card>
      )}

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          <p>{t("empty.noArtworks")}</p>
          <p className="mt-1">{t("empty.addFirst")}</p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4" style={{ columnGap: "1rem" }}>
          {filtered.map((item) => (
            <ArtworkCard
              key={item.id}
              item={item}
              t={t}
              lang={lang}
              categories={cats}
              getCategoryLabel={(lng, k) => getCategoryLabel(lng, k)}
              onSave={handleSave}
              onDelete={handleDelete}
              onOpenDetail={openDetail}
            />
          ))}
        </div>
      )}

      <ArtworkDetail open={detailOpen} onOpenChange={setDetailOpen} item={detailItem} t={t} onBuy={() => setDetailOpen(false)} />

      <IGComposerPreview
        open={igOpen}
        onOpenChange={setIgOpen}
        sourceBlob={addImageBlob}
        lang={lang}
        onConfirm={(images) => { setIgImages(images); }}
      />
    </div>
  );
}
