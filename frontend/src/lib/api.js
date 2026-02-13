const DEV_LOCAL = (() => {
  if (typeof window === "undefined") return false;
  if (window.__FORCE_DEV_REMOTE__ === true) return false;
  if (window.__FORCE_DEV_LOCAL__ === true) return true;

  const h = window.location.hostname;
  const isLocal = h === "localhost" || h === "127.0.0.1";
  return isLocal;
})();

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE) ||
  (typeof window !== "undefined" && window.__API_BASE__) ||
  "https://jpart.at/api.php";

const isPhp = /\.php($|\?)/i.test(API_BASE);

const ADMIN_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ADMIN_API_KEY) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_ADMIN_API_KEY) ||
  (typeof window !== "undefined" && window.__ADMIN_API_KEY__) ||
  "";

const UPLOAD_ENDPOINT =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_UPLOAD_ENDPOINT) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_UPLOAD_ENDPOINT) ||
  (typeof window !== "undefined" && window.__UPLOAD_ENDPOINT__) ||
  "https://jpart.at/upload.php";

const UPLOAD_KEY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_UPLOAD_KEY) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_UPLOAD_KEY) ||
  (typeof window !== "undefined" && window.__UPLOAD_KEY__) ||
  "";

const API_FAST =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_FAST) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_API_FAST) ||
  (typeof window !== "undefined" && window.__API_FAST__) ||
  "https://api.jpart.at/api";

const RESOLVED_API_FAST = (() => {
  let base = API_FAST;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const isLocal = h === "localhost" || h === "127.0.0.1";
    if (!isLocal && /^(https?:\/\/)?(localhost|127\.0\.0\.1)/i.test(base)) {
      base = "https://api.jpart.at/api";
    }
    window.__API_FAST__ = base;
  }
  return base;
})();

const IG_PROXY =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_IG_PROXY) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_IG_PROXY) ||
  (typeof window !== "undefined" && window.__IG_PROXY__) ||
  `${RESOLVED_API_FAST.replace(/\/$/, "")}/instagram/queue`;


const AI_CAPTION_ENDPOINT =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_CAPTION_ENDPOINT) ||
  (typeof process !== "undefined" && process.env?.REACT_APP_AI_CAPTION_ENDPOINT) ||
  (typeof window !== "undefined" && window.__AI_CAPTION_ENDPOINT__) ||
  `${RESOLVED_API_FAST.replace(/\/$/, "")}/ai/caption`;

const writeHeaders = () =>
  isPhp && ADMIN_API_KEY ? { "X-API-Key": ADMIN_API_KEY } : {};

function withBodyKey(body) {
  if (isPhp && ADMIN_API_KEY && body && typeof body === "object" && !(body instanceof FormData)) {
    return { ...body, key: ADMIN_API_KEY };
  }
  return body;
}

export async function getSiteSettings() {
  return http("GET", "site_settings");
}

export async function updateSiteSettings(payload) {
  return http("POST", "site_settings", {
    headers: writeHeaders(),
    body: withBodyKey(payload),
  });
}

export function getSessionId() {
  try {
    const k = "__sid";
    let v = localStorage.getItem(k);
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(k, v); }
    return v;
  } catch { return Math.random().toString(36).slice(2); }
}

export async function trackEvent(event_name, { path = location.pathname, referrer = document.referrer, artwork_id, extra } = {}) {
  const payload = { event_name, path, referrer, session_id: getSessionId() };
  if (artwork_id != null) payload.artwork_id = artwork_id;
  if (extra) payload.extra = extra;

  const url = new URL(API_BASE);
  url.searchParams.set("resource", "track");

  try {
    const ok = navigator.sendBeacon && navigator.sendBeacon(url.toString(), new Blob([JSON.stringify(payload)], { type: "application/json" }));
    if (ok) return;
  } catch {}
  try {
    await fetch(url.toString(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true });
  } catch {}
}

export async function getAnalyticsSummary(days = 30) {
  const u = new URL(API_BASE);
  u.searchParams.set("resource", "analytics_summary");
  u.searchParams.set("days", String(days));
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`analytics ${res.status}`);
  return res.json();
}



function buildUrl(resourceOrPath, params = {}) {
  if (isPhp) {
    const u = new URL(API_BASE);
    u.searchParams.set("resource", String(resourceOrPath).replace(/^\//, ""));
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
    }
    return u.toString();
  } else {
    const base = API_BASE.replace(/\/$/, "");
    const path = String(resourceOrPath).startsWith("/") ? resourceOrPath : `/${resourceOrPath}`;
    const u = new URL(base + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
    }
    return u.toString();
  }
}

async function http(method, resourceOrPath, { params, body, headers } = {}) {
  const url = buildUrl(resourceOrPath, params);
  const isForm = body && typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(url, {
    method,
    headers: {
      ...(isForm ? {} : body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  let json = {};
  try {
    json = res.status === 204 ? {} : await res.json();
  } catch {
    json = {};
  }

  if (!res.ok) {
    const msg = json?.detail || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

async function httpFast(path, { method = "POST", body } = {}) {
  const url = `${RESOLVED_API_FAST.replace(/\/$/, "")}${path}`;
  const isForm = body && typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: isForm ? {} : { "Content-Type": "application/json" },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.detail || json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

const devDB = {
  nextId: 1,
  artworks: [],
  categories: ["Painting", "Sketch", "Print"],
  blobs: [],
};

function devClone(x) { return JSON.parse(JSON.stringify(x)); }
function devMakeId() { return `dev-${devDB.nextId++}`; }

export async function health() {
  if (DEV_LOCAL) return { ok: true, mode: "dev-local" };
  if (isPhp) return http("GET", "health");
  const base = API_BASE.endsWith("/api") ? API_BASE.slice(0, -4) : API_BASE;
  const r = await fetch(`${base}/health`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || "health failed");
  return j;
}

export async function listArtworks(params = {}) {
  if (DEV_LOCAL) {
    let out = [...devDB.artworks];
    if (params?.category) out = out.filter((a) => a.category === params.category);
    return devClone(out);
  }
  return http("GET", "artworks", { params });
}

export async function createArtwork(payload) {
  if (DEV_LOCAL) {
    const id = devMakeId();
    const now = new Date().toISOString();
    const doc = {
      id,
      title: payload.title || "Untitled",
      priceCents: Number(payload.priceCents || 0),
      category: payload.category || "Painting",
      imageUrl: payload.imageUrl || payload.image || "",
      image: payload.imageUrl || payload.image || "",
      year: payload.year ?? undefined,
      medium: payload.medium ?? "",
      dimensions: payload.dimensions ?? "",
      widthCm: payload.widthCm ?? undefined,
      heightCm: payload.heightCm ?? undefined,
      status: payload.status || "available",
      description: payload.description || "",
      ...(payload.extraImages ? { extraImages: payload.extraImages } : {}),
      createdAt: now,
      updatedAt: now,
    };
    devDB.artworks.unshift(doc);
    if (doc.category && !devDB.categories.includes(doc.category)) {
      devDB.categories.push(doc.category);
    }
    return JSON.parse(JSON.stringify(doc));
  }

  const useFast =
    !isPhp || (typeof window !== "undefined" && window.__MUTATE_VIA_FAST__ === true);

  if (useFast) {
    const url = `${RESOLVED_API_FAST.replace(/\/$/, "")}/artworks`;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Not authorized. Please log in.");
    if (!res.ok) throw new Error(json.detail || json.error || `Create failed (${res.status})`);
    return json;
  }

  return http("POST", "artworks", { headers: writeHeaders(), body: withBodyKey(payload) });
}

export async function updateArtwork(id, payload) {
  if (DEV_LOCAL) {
    const i = devDB.artworks.findIndex((a) => a.id === id);
    if (i >= 0) {
      devDB.artworks[i] = { ...devDB.artworks[i], ...payload, id };
      return JSON.parse(JSON.stringify(devDB.artworks[i]));
    }
    throw new Error("not found");
  }

  const useFast =
    !isPhp || (typeof window !== "undefined" && window.__MUTATE_VIA_FAST__ === true);

  if (useFast) {
    const url = `${RESOLVED_API_FAST.replace(/\/$/, "")}/artworks/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Not authorized. Please log in.");
    if (!res.ok) throw new Error(json.detail || json.error || `Update failed (${res.status})`);
    return json;
  }

  const params = isPhp ? { id } : undefined;
  const path = isPhp ? "artworks" : `artworks/${encodeURIComponent(id)}`;
  return http("PUT", path, { params, headers: writeHeaders(), body: withBodyKey(payload) });
}

export async function deleteArtwork(id) {
  if (DEV_LOCAL) {
    const before = devDB.artworks.length;
    devDB.artworks = devDB.artworks.filter((a) => a.id !== id);
    if (devDB.artworks.length === before) throw new Error("not found");
    return { ok: true };
  }

  const useFast =
    !isPhp || (typeof window !== "undefined" && window.__MUTATE_VIA_FAST__ === true);

  if (useFast) {
    const url = `${RESOLVED_API_FAST.replace(/\/$/, "")}/artworks/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.status === 401) throw new Error("Not authorized. Please log in.");
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.detail || json.error || `Delete failed (${res.status})`);
    }
    return { ok: true };
  }

  const params = isPhp ? { id } : undefined;
  const path = isPhp ? "artworks" : `artworks/${encodeURIComponent(id)}`;
  return http("DELETE", path, { params, headers: writeHeaders() });
}

export async function listCategories() {
  if (DEV_LOCAL) return devClone(devDB.categories.map((key) => ({ key })));
  return http("GET", "categories");
}

export async function createCategory(cat) {
  if (DEV_LOCAL) {
    const key = cat?.key || cat;
    if (key && !devDB.categories.includes(key)) devDB.categories.push(key);
    return { id: devMakeId(), key };
  }
  return http("POST", "categories", { headers: writeHeaders(), body: withBodyKey(cat) });
}

export async function deleteCategory(id) {
  if (DEV_LOCAL) {
    devDB.categories = devDB.categories.filter((c) => c !== id && c.key !== id);
    return { ok: true };
  }
  const params = isPhp ? { id } : undefined;
  const path = isPhp ? "categories" : `categories/${encodeURIComponent(id)}`;
  return http("DELETE", path, { params, headers: writeHeaders() });
}

export async function createCheckoutSession({ artworkId, buyerEmail }) {
  if (DEV_LOCAL) return { url: null, dev: true };
  if (isPhp) throw new Error("Checkout is not configured on the PHP API.");
  const fd = new FormData();
  fd.append("artworkId", artworkId);
  if (buyerEmail) fd.append("buyerEmail", buyerEmail);
  return http("POST", "/checkout/create-session", { body: fd });
}

export async function uploadImageBlob(blob, filename = "image.jpg") {
  if (DEV_LOCAL) {
    const url = URL.createObjectURL(blob);
    devDB.blobs.push(url);
    return url;
  }
  const fd = new FormData();
  fd.append("key", UPLOAD_KEY);
  fd.append("file", blob, filename);
  const res = await fetch(UPLOAD_ENDPOINT, { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "upload failed");
  return json.url;
}

export async function igQueue({ imageUrl, caption }) {
  if (DEV_LOCAL) return { ok: true, dev: true, imageUrl, caption };
  const fd = new FormData();
  fd.append("image_url", imageUrl);
  fd.append("caption", caption);
  const res = await fetch(IG_PROXY, { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok !== true) throw new Error(json.detail || "IG queue failed");
  return json;
}

export async function igQueueCarousel({ images, caption }) {
  const json = await httpFast("/instagram/queue", {
    method: "POST",
    body: { images, caption },
  });
  return json;
}

export async function igStageScene({ imageUrl, imageData, scene = "easel", extraPrompt = "", lang = "en" }) {
  const endpoint = `${RESOLVED_API_FAST.replace(/\/$/, "")}/ai/stage`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, imageData, scene, extraPrompt, lang }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    const msg = json.detail || json.error || `stage failed (${res.status})`;
    throw new Error(msg);
  }
  return json.dataUrl;
}

export async function generateAICaption({
  imageUrl, imageData, title, year, medium, dimensions, lang = "en", style, system, hashtags,
}) {
  const forceRemote = (typeof window !== "undefined" && window.__FORCE_DEV_REMOTE__ === true);
  if (DEV_LOCAL && !forceRemote) {
    const y = year ? ` (${year})` : "";
    const dims = dimensions ? ` — ${dimensions}` : "";
    return `${title || "Untitled"}\n${medium || "Acrylic"}${y}${dims}. Short dev-local caption.\n\n#art #painting #devlocal`;
  }
  const res = await fetch(AI_CAPTION_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl, imageData, title, year, medium, dimensions, lang, style, system, hashtags,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.detail || json.error || "AI caption failed");
  return json.caption;
}

export const __apiConfig = {
  DEV_LOCAL,
  API_BASE,
  API_FAST,
  isPhp,
  hasAdminKey: Boolean(ADMIN_API_KEY),
  uploadEndpoint: UPLOAD_ENDPOINT,
  hasUploadKey: Boolean(UPLOAD_KEY),
  igProxy: IG_PROXY,
  aiCaptionEndpoint: AI_CAPTION_ENDPOINT,
};