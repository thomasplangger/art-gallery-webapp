import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const I18nContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (key, params) => key,
  languages: [],
});

const translations = {
  en: {
    app: { title: "Art Gallery" },
    nav: {
      gallery: "Gallery",
      about: "About",
      impressum: "Impressum",
      gallery_sub: "Browse artworks",
      about_sub: "Artist bio & photo",
      impressum_sub: "Legal notice",
      language: "Language",
    },
    search: { placeholder: "Search by name…" },
    filters: {
      categories: "Categories",
      all: "All",
      sortBy: "Sort by",
      priceAsc: "Price: Low to High",
      priceDesc: "Price: High to Low",
      categoryAZ: "Category: A → Z",
      nameAZ: "Name: A → Z",
      year: "Year",
      anyYear: "Any year",

      more: "More filters",
      title: "Filters",
      priceLabel: "Price (EUR)",
      yearLabel: "Year",
      sizeLabel: "Size (area cm²)",
      categoryLabel: "Category",
      mediumLabel: "Medium",
      availability: "Availability",
      reset: "Reset",
      apply: "Apply",
    },
    form: {
      addNew: "Add Artwork",
      edit: "Edit Artwork",
      name: "Title",
      price: "Price (EUR)",
      category: "Category",
      imageUrl: "Image URL",
      upload: "Upload Image",
      otherCategory: "Other…",
      year: "Year",
      medium: "Medium",
      dimensions: "Dimensions",
      status: "Status",
      add: "Add",
      save: "Save",
      cancel: "Cancel",
      remove: "Delete",

      image: "Image",
      dragDrop: "Drag & drop image here, or",
      selectFile: "select a file",
      fileStaged: "File staged locally. It will upload when you click “Add”.",
      chooseSize: "Choose size",
      custom: "Custom",
      width: "width",
      height: "height",
      postInstagram: "Post on Instagram",
      autoCaption: "Automatic caption",
      captionPreview: "Instagram caption",
      copyCaption: "Copy caption",

      sizeMissing: "Size missing",
      enterNumericSize: "Please enter numeric width and height.",
    },
    status: {
      available: "Available",
      reserved: "Reserved",
      sold: "Sold",
    },
    card: { edit: "Edit", delete: "Delete", sold: "Sold", buy: "Buy" },
    empty: { noArtworks: "No artworks found.", addFirst: "Add your first artwork to get started." },

    categories: {
      painting: "Painting",
      sketch: "Sketch",
      digital: "Digital",
      print: "Print",
      Painting: "Painting",
      Sketch: "Sketch",
      Print: "Print",
    },

    toast: {
      error: "Error",
      saved: "Saved",
      added: "Artwork added",
      deleted: "Artwork deleted",
      copiedCaption: "Caption copied",
      copiedCaptionDesc: "Instagram caption copied to clipboard. Paste it in Instagram.",
      captionReady: "Caption ready",
      captionManual: "Could not copy automatically. Select and copy from the preview.",
      igNeedsTwoImages: "Instagram carousel needs 2 images. Use “Preview IG Carousel…” and generate the AI image.",
    },
    note: { uploadMock: "Uploads will be enabled after storage setup. For now, use an Image URL." },
  },

  de: {
    app: { title: "Kunstgalerie" },
    nav: {
      gallery: "Galerie",
      about: "Über mich",
      impressum: "Impressum",
      gallery_sub: "Werke ansehen",
      about_sub: "Künstlerbio & Foto",
      impressum_sub: "Rechtliche Hinweise",
      language: "Sprache",
    },
    search: { placeholder: "Nach Name suchen…" },
    filters: {
      categories: "Kategorien",
      all: "Alle",
      sortBy: "Sortieren nach",
      priceAsc: "Preis: aufsteigend",
      priceDesc: "Preis: absteigend",
      categoryAZ: "Kategorie: A → Z",
      nameAZ: "Name: A → Z",
      year: "Jahr",
      anyYear: "Beliebiges Jahr",

      more: "Weitere Filter",
      title: "Filter",
      priceLabel: "Preis (EUR)",
      yearLabel: "Jahr",
      sizeLabel: "Größe (Fläche in cm²)",
      categoryLabel: "Kategorie",
      mediumLabel: "Medium",
      availability: "Verfügbarkeit",
      reset: "Zurücksetzen",
      apply: "Anwenden",
    },
    form: {
      addNew: "Werk hinzufügen",
      edit: "Werk bearbeiten",
      name: "Titel",
      price: "Preis (EUR)",
      category: "Kategorie",
      imageUrl: "Bild-URL",
      upload: "Bild hochladen",
      otherCategory: "Andere…",
      year: "Jahr",
      medium: "Medium",
      dimensions: "Maße",
      status: "Status",
      add: "Hinzufügen",
      save: "Speichern",
      cancel: "Abbrechen",
      remove: "Löschen",

      image: "Bild",
      dragDrop: "Bild hierher ziehen oder",
      selectFile: "Datei auswählen",
      fileStaged: "Datei lokal bereitgestellt. Upload erfolgt beim Klick auf „Hinzufügen“.",
      chooseSize: "Maße auswählen",
      custom: "Benutzerdefiniert",
      width: "Breite",
      height: "Höhe",
      postInstagram: "Auf Instagram posten",
      autoCaption: "Automatische Bildunterschrift",
      captionPreview: "Instagram-Bildunterschrift",
      copyCaption: "Bildunterschrift kopieren",

      sizeMissing: "Maße fehlen",
      enterNumericSize: "Bitte Breite und Höhe als Zahlen eingeben.",
    },
    status: { available: "Verfügbar", reserved: "Reserviert", sold: "Verkauft" },
    card: { edit: "Bearbeiten", delete: "Löschen", sold: "Verkauft", buy: "Kaufen" },
    empty: { noArtworks: "Keine Werke gefunden.", addFirst: "Fügen Sie Ihr erstes Werk hinzu." },

    categories: {
      painting: "Malerei",
      sketch: "Skizze",
      digital: "Digital",
      print: "Druck",
      Painting: "Malerei",
      Sketch: "Skizze",
      Print: "Druck",
    },

    toast: {
      error: "Fehler",
      saved: "Gespeichert",
      added: "Werk hinzugefügt",
      deleted: "Werk gelöscht",
      copiedCaption: "Bildunterschrift kopiert",
      copiedCaptionDesc: "Instagram-Text wurde in die Zwischenablage kopiert. Füge ihn in Instagram ein.",
      captionReady: "Bildunterschrift bereit",
      captionManual: "Konnte nicht automatisch kopieren. Bitte aus der Vorschau kopieren.",
      igNeedsTwoImages: "Für das Instagram-Karussell brauchst du 2 Bilder. Öffne „Preview IG Carousel…“ und generiere das KI-Bild.",
    },
    note: { uploadMock: "Uploads werden nach der Storage-Einrichtung aktiviert. Verwenden Sie vorerst eine Bild-URL." },
  },
};

function getNested(obj, path, fallback) {
  return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj) ?? fallback ?? path;
}

export const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState("en");
  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored && translations[stored]) setLangState(stored);
  }, []);
  const setLang = (l) => {
    if (translations[l]) {
      setLangState(l);
      localStorage.setItem("lang", l);
    }
  };
  const t = useMemo(() => {
    return (key, params = {}) => {
      const str = getNested(translations[lang], key, key);
      if (typeof str !== "string") return key;
      return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? "");
    };
  }, [lang]);
  const languages = useMemo(() => Object.keys(translations), []);
  const value = useMemo(() => ({ lang, setLang, t, languages }), [lang, t, languages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
export const getCategoryLabel = (lang, key) => getNested(translations[lang], `categories.${key}`, key);
