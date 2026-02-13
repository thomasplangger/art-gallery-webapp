import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Pencil, Trash2 } from "lucide-react";
import { centsFromEuroStr } from "../mock/mock";
import { useToast } from "../hooks/use-toast";
import { uploadImageBlob } from "../lib/api";
import { useAdmin } from "../context/AdminContext";
import { compressImage, idbGet, objectUrlFromBlob } from "../lib/idb";

function parseDims(str) {
  if (!str) return null;
  const cleaned = String(str).toLowerCase().replace(/,/g, ".").replace(/\s+/g, "");
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*[x×:-]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

const norm = (s) => String(s || "").trim().toLowerCase();
const uniq = (arr) => Array.from(new Set(arr));
const parseMediums = (s) => {
  if (!s) return [];
  return uniq(String(s).split(/[;,|]+/).map((x) => x.trim()).filter(Boolean));
};

export default function ArtworkCard({
  item, t, lang, categories, mediumOptions = [], getCategoryLabel, onSave, onDelete, onOpenDetail
}) {
  const { toast } = useToast();
  const { isAdmin } = useAdmin();

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(String((item.priceCents || 0) / 100));
  const [category, setCategory] = useState(item.category);
  const [imageUrl, setImageUrl] = useState(item.image || "");
  const [imageKey, setImageKey] = useState(item.imageKey || null);
  const [resolvedSrc, setResolvedSrc] = useState(imageUrl);
  const [customCategory, setCustomCategory] = useState("");
  const [year, setYear] = useState(item.year || new Date().getFullYear());

  const initialMediums = useMemo(() => new Set(parseMediums(item.medium).map(norm)), [item.medium]);
  const [mediumSet, setMediumSet] = useState(initialMediums);
  const [customMedium, setCustomMedium] = useState("");

  const [dimensions, setDimensions] = useState(item.dimensions || "");
  const [widthCm, setWidthCm] = useState(item.widthCm || "");
  const [heightCm, setHeightCm] = useState(item.heightCm || "");
  const [status, setStatus] = useState(item.status || "available");
  const [description, setDescription] = useState(item.description || "");

  const [aspect, setAspect] = useState(() => {
    const w = Number(item.widthCm);
    const h = Number(item.heightCm);
    if (w > 0 && h > 0) return w / h;
    const parsed = parseDims(item.dimensions);
    if (parsed) return parsed.w / parsed.h;
    return 0.75;
  });

  useEffect(() => {
    let revoke;
    async function resolve() {
      if (imageKey) {
        const blob = await idbGet(imageKey);
        if (blob) {
          const url = objectUrlFromBlob(blob);
          setResolvedSrc(url);
          item._resolvedSrc = url;
          revoke = () => URL.revokeObjectURL(url);
          return;
        }
      }
      setResolvedSrc(imageUrl);
      item._resolvedSrc = imageUrl;
    }
    resolve();
    return () => revoke && revoke();
  }, [imageKey, imageUrl, item]);

  const displayCategory = useMemo(
    () => getCategoryLabel(lang, item.category),
    [lang, item.category, getCategoryLabel]
  );

  const toggleMedium = (m) => {
    const n = norm(m);
    const next = new Set(mediumSet);
    next.has(n) ? next.delete(n) : next.add(n);
    setMediumSet(next);
  };
  const addCustomMediumNow = () => {
    const v = customMedium.trim();
    if (!v) return;
    const n = norm(v);
    setMediumSet((prev) => new Set(prev).add(n));
    setCustomMedium("");
  };

  const handleSave = () => {
    const finalCategory = category === "__other__" && customCategory.trim()
      ? customCategory.trim() : category;

    const pretty = Array.from(mediumSet).map((tok) => {
      const hit = mediumOptions.find((opt) => norm(opt) === tok);
      return hit || tok;
    }).join(", ");

    const updated = {
      ...item,
      title: title.trim() || item.title,
      priceCents: centsFromEuroStr(price),
      category: finalCategory,
      image: imageUrl.trim() || item.image,
      imageKey: imageKey || item.imageKey,
      year: Number(year) || item.year,
      medium: pretty,
      dimensions: dimensions.trim(),
      widthCm: widthCm ? Number(widthCm) : undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      status,
      description: description.trim(),
    };
    onSave(updated);
    setEditing(false);
  };

  const onFile = async (file) => {
    if (!file) return;
    try {
      const blob = await compressImage(file, 1400, 0.82);
      const url = await uploadImageBlob(blob, file.name || "image.jpg");
      setImageKey(null);
      setImageUrl(url);
      setResolvedSrc(url);
      item._resolvedSrc = url;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(blob);
    } catch (e) {
      toast({ title: "Image error", description: String(e.message || e) });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  useEffect(() => {
    const w = Number(widthCm);
    const h = Number(heightCm);
    if (w > 0 && h > 0) setAspect(w / h);
  }, [widthCm, heightCm]);

  const handleImgLoad = (ev) => {
    const img = ev.currentTarget;
    if (img?.naturalWidth && img?.naturalHeight) {
      const r = img.naturalWidth / img.naturalHeight;
      if (!aspect || Math.abs(aspect - r) > 0.02) setAspect(r);
    }
  };

  return (
    <Card
      className="mb-4 bg-card"
      style={{
        breakInside: "avoid",
        WebkitColumnBreakInside: "avoid",
        MozColumnBreakInside: "avoid",
        display: "block",
      }}
    >
      <CardContent className="p-0">
        <div className="cursor-pointer" onClick={() => onOpenDetail?.(item)}>
          <div
            className="bg-muted border border-border rounded-md overflow-hidden"
            style={{ width: "100%", aspectRatio: aspect || 0.75 }}
          >
            <img
              src={resolvedSrc}
              alt={item.title}
              loading="lazy"
              onLoad={handleImgLoad}
              className="w-full h-full object-contain"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              srcSet={resolvedSrc ? `${resolvedSrc} 900w` : undefined}
            />
          </div>
        </div>

        <div className="p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold break-words">{item.title}</h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <Badge variant="secondary">{displayCategory}</Badge>
              {item.year && (
                <>
                  <span className="opacity-50">•</span>
                  <span>{item.year}</span>
                </>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={() => setEditing((v) => !v)} aria-label={t("card.edit")}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={() => onDelete(item.id)} aria-label={t("card.delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {isAdmin && editing && (
          <div className="p-3 pt-0 border-t border-border space-y-2 animate-accordion-down">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.name")}</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("form.name")} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.price")}</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.category")}</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder={t("form.category")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (<SelectItem key={c} value={c}>{getCategoryLabel(lang, c)}</SelectItem>))}
                    <SelectItem value="__other__">{t("form.otherCategory")}</SelectItem>
                  </SelectContent>
                </Select>
                {category === "__other__" && (
                  <Input className="mt-2" placeholder={t("form.otherCategory")} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                )}
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Image</label>
                <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
                <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="mt-2 border border-dashed rounded-md p-3 text-center text-sm text-muted-foreground">
                  <p>Drag & drop image here, or</p>
                  <label className="underline cursor-pointer">
                    select a file
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Year</label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2025" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Medium</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mediumOptions.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => toggleMedium(m)}
                      className={`text-sm px-2 py-1 rounded-full border transition-colors ${mediumSet.has(norm(m)) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                      title={m}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input
                    className="max-w-xs"
                    placeholder="Custom medium (e.g. Watercolor)"
                    value={customMedium}
                    onChange={(e) => setCustomMedium(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomMediumNow(); } }}
                  />
                  <Button type="button" variant="secondary" onClick={addCustomMediumNow}>
                    Add
                  </Button>
                </div>
                {mediumSet.size > 0 && (
                  <div className="text-xs mt-1 text-muted-foreground">
                    Selected: {Array.from(mediumSet).join(", ")}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Dimensions (text)</label>
                <Input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="60×80 cm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">Width (cm)</label>
                  <Input value={widthCm} onChange={(e) => setWidthCm(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">Height (cm)</label>
                  <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">Description</label>
                <textarea className="w-full border rounded-md p-2 text-sm bg-background" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted-foreground">{t("form.status")}</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" onClick={() => setEditing(false)}>{t("form.cancel")}</Button>
              <Button onClick={handleSave}>{t("form.save")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
