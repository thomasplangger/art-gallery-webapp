import React, { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "../components/ui/sheet";
import { Button } from "../components/ui/button";
import { Slider } from "../components/ui/slider";
import { Checkbox } from "../components/ui/checkbox";
import { Separator } from "../components/ui/separator";
import { useI18n, getCategoryLabel } from "../i18n";

const norm = (s) => String(s || "").trim().toLowerCase();

function getMediumLabelLocal(lang, key) {
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

export default function FilterBar({
  categories = [],
  mediums = [],
  priceMin = 0,
  priceMax = 100000,
  yearMin = 1900,
  yearMax = new Date().getFullYear(),
  areaMin = 0,
  areaMax = 10000,
  value,
  onChange,
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  const setField = (k, v) => setLocal((s) => ({ ...s, [k]: v }));

  const apply = () => {
    onChange?.(local);
    setOpen(false);
  };

  const reset = () => {
    const v = {
      categories: new Set(),
      mediums: new Set(),
      availability: new Set(),
      priceRange: [priceMin, priceMax],
      yearRange: [yearMin, yearMax],
      areaRange: [areaMin, areaMax],
    };
    onChange?.(v);
    setLocal(v);
  };

  const catChecked = (c) => local.categories.has(c);
  const toggleCat = (c) => {
    const next = new Set(local.categories);
    next.has(c) ? next.delete(c) : next.add(c);
    setField("categories", next);
  };

  const medChecked = (m) => local.mediums.has(norm(m));
  const toggleMed = (m) => {
    const key = norm(m);
    const next = new Set(local.mediums);
    next.has(key) ? next.delete(key) : next.add(key);
    setField("mediums", next);
  };

  const statuses = ["available", "reserved", "sold"];
  const statusChecked = (s) => local.availability.has(s);
  const toggleStatus = (s) => {
    const next = new Set(local.availability);
    next.has(s) ? next.delete(s) : next.add(s);
    setField("availability", next);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">{t("filters.more")}</Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("filters.title")}</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.priceLabel")}</div>
            <Slider
              defaultValue={[local.priceRange[0], local.priceRange[1]]}
              min={priceMin}
              max={priceMax}
              step={100}
              onValueChange={(v) => setField("priceRange", v)}
            />
            <div className="text-xs text-muted-foreground mt-1">
              € {Math.round(local.priceRange[0] / 100)} – € {Math.round(local.priceRange[1] / 100)}
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.yearLabel")}</div>
            <Slider
              defaultValue={[local.yearRange[0], local.yearRange[1]]}
              min={yearMin}
              max={yearMax}
              step={1}
              onValueChange={(v) => setField("yearRange", v)}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {local.yearRange[0]} – {local.yearRange[1]}
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.sizeLabel")}</div>
            <Slider
              defaultValue={[local.areaRange[0], local.areaRange[1]]}
              min={areaMin}
              max={areaMax}
              step={50}
              onValueChange={(v) => setField("areaRange", v)}
            />
            <div className="text-xs text-muted-foreground mt-1">
              {local.areaRange[0]} – {local.areaRange[1]} cm²
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.categoryLabel")}</div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={catChecked(c)} onCheckedChange={() => toggleCat(c)} />
                  <span className="truncate">{getCategoryLabel(lang, c)}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.mediumLabel")}</div>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-auto pr-1">
              {mediums.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={medChecked(m)} onCheckedChange={() => toggleMed(m)} />
                  <span className="truncate">{getMediumLabelLocal(lang, m)}</span>
                </label>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <div className="text-sm font-medium mb-2">{t("filters.availability")}</div>
            <div className="grid grid-cols-2 gap-2">
              {statuses.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={statusChecked(s)} onCheckedChange={() => toggleStatus(s)} />
                  <span className="truncate">
                    {s === "available" ? t("status.available") : s === "reserved" ? t("status.reserved") : t("status.sold")}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={reset}>{t("filters.reset")}</Button>
            <Button onClick={apply}>{t("filters.apply")}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
