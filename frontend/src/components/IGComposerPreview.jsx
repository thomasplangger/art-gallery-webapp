// src/components/IGComposerPreview.jsx
import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { igStageScene } from "../lib/api";

/* ---------- scene presets ---------- */
const PRESETS = [
  {
    value: "easel",
    label: "On an easel",
    scene: "easel",
    presetPrompt: "",
  },
  {
    value: "wall",
    label: "On the wall",
    scene: "wall",
    presetPrompt: "",
  },
  {
    value: "gallery",
    label: "Gallery interior",
    scene: "gallery",
    presetPrompt:
      "in a clean, contemporary gallery with soft neutral walls and natural overhead lighting",
  },
  {
    value: "studio",
    label: "Artist studio",
    scene: "studio",
    presetPrompt:
      "in an artist studio with soft daylight, subtle clutter, and creative atmosphere",
  },
  {
    value: "table-room",
    label: "On a wooden table (nice room)",
    scene: "studio",
    presetPrompt:
      "placed on a wooden table in a cozy, well-lit living room; warm ambient light and gentle depth of field",
  },
  {
    value: "minimal-desk",
    label: "On a minimalist desk",
    scene: "studio",
    presetPrompt:
      "on a minimalist light-wood desk by a window with soft natural light and clean decor",
  },
  {
    value: "coffee-table",
    label: "On a coffee shop table",
    scene: "studio",
    presetPrompt:
      "on a rustic coffee shop table with soft bokeh background lights; warm, inviting atmosphere",
  },
];

/* ---------- helpers ---------- */

async function composeFourFive({ src, zoom = 1, offsetX = 0, offsetY = 0 }) {
  if (!src) throw new Error("No source image");
  const W = 1080, H = 1350;

  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = (e) => rej(e || new Error("Image load failed"));
    i.crossOrigin = "anonymous";
    i.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  const aspect = img.naturalWidth / img.naturalHeight;
  const targetH = H * 0.92;
  const targetW = targetH * aspect;

  const drawW = targetW * zoom;
  const drawH = targetH * zoom;

  const cx = W / 2 + offsetX;
  const cy = H / 2 + offsetY;

  const dx = cx - drawW / 2;
  const dy = cy - drawH / 2;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, dx, dy, drawW, drawH);

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function normalizeFourFive(dataUrl) {
  const W = 1080, H = 1350;
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);

  const rCan = W / H;
  const rImg = img.naturalWidth / img.naturalHeight;
  let dw, dh;
  if (rImg > rCan) { dw = W; dh = dw / rImg; } else { dh = H; dw = dh * rImg; }
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/* ---------- component ---------- */

export default function IGComposerPreview({
  open,
  onOpenChange,
  sourceBlob,
  src,
  lang = "en",
  onConfirm,
}) {
  const [srcUrl, setSrcUrl] = useState("");
  useEffect(() => {
    if (!open) return;
    let revoke;
    if (sourceBlob instanceof Blob) {
      const u = URL.createObjectURL(sourceBlob);
      setSrcUrl(u);
      revoke = () => URL.revokeObjectURL(u);
    } else {
      setSrcUrl(src || "");
    }
    return () => revoke && revoke();
  }, [open, sourceBlob, src]);

  const [zoom1, setZoom1] = useState(1);
  const [offX1, setOffX1] = useState(0);
  const [offY1, setOffY1] = useState(0);

  const [zoom2, setZoom2] = useState(1);
  const [offX2, setOffX2] = useState(0);
  const [offY2, setOffY2] = useState(0);

  const [presetValue, setPresetValue] = useState("easel");
  const [scene, setScene] = useState("easel");
  const [presetPrompt, setPresetPrompt] = useState("");
  const [extraPrompt, setExtraPrompt] = useState("");

  const [gen1Base, setGen1Base] = useState(null);
  const [gen2Base, setGen2Base] = useState(null);

  const [gen1Preview, setGen1Preview] = useState(null);
  const [gen2Preview, setGen2Preview] = useState(null);

  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!srcUrl) { setGen1Base(null); return; }
    setGen1Base(srcUrl);
  }, [srcUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (gen1Base) {
          const d = await composeFourFive({ src: gen1Base, zoom: zoom1, offsetX: offX1, offsetY: offY1 });
          if (!cancelled) setGen1Preview(d);
        } else {
          setGen1Preview(null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [gen1Base, zoom1, offX1, offY1]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (gen2Base) {
          const d = await composeFourFive({ src: gen2Base, zoom: zoom2, offsetX: offX2, offsetY: offY2 });
          if (!cancelled) setGen2Preview(d);
        } else {
          setGen2Preview(null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [gen2Base, zoom2, offX2, offY2]);

  const applyPreset = (val) => {
    const p = PRESETS.find((x) => x.value === val) || PRESETS[0];
    setPresetValue(p.value);
    setScene(p.scene);
    setPresetPrompt(p.presetPrompt || "");
  };

  useEffect(() => {
    if (open) applyPreset(presetValue);
  }, [open]);

  const buildSecond = async () => {
    if (!srcUrl) return;
    setBusy(true); setErrMsg("");
    try {
      const cropped = await composeFourFive({ src: srcUrl, zoom: zoom1, offsetX: offX1, offsetY: offY1 });

      const combinedPrompt = [presetPrompt, extraPrompt].filter(Boolean).join(" ").trim();

      const result = await igStageScene({ imageData: cropped, scene, extraPrompt: combinedPrompt, lang });
      const returned = typeof result === "string" ? result : (result?.dataUrl || "");
      if (!returned) throw new Error("No image returned from AI");

      const normalized = await normalizeFourFive(returned);
      setGen2Base(normalized);

      setActive(1);
      return normalized;
    } catch (e) {
      setErrMsg(e?.message || "Could not generate the staged image.");
      throw e;
    } finally { setBusy(false); }
  };

  const handleUse = async () => {
    try {
      let d1 = gen1Preview;
      if (!d1 && gen1Base) d1 = await composeFourFive({ src: gen1Base, zoom: zoom1, offsetX: offX1, offsetY: offY1 });

      let d2 = gen2Preview;
      if (!d2) {
        const base = await buildSecond();
        d2 = await composeFourFive({ src: base, zoom: zoom2, offsetX: offX2, offsetY: offY2 });
      }

      onConfirm?.([d1, d2]);
      onOpenChange?.(false);
    } catch {}
  };

  const close = () => onOpenChange?.(false);

  const activeZoom   = active === 0 ? zoom1 : zoom2;
  const activeOffX   = active === 0 ? offX1 : offX2;
  const activeOffY   = active === 0 ? offY1 : offY2;
  const setActiveZoom = (v) => (active === 0 ? setZoom1(v) : setZoom2(v));
  const setActiveOffX = (v) => (active === 0 ? setOffX1(v) : setOffX2(v));
  const setActiveOffY = (v) => (active === 0 ? setOffY1(v) : setOffY2(v));
  const resetActiveView = () => {
    if (active === 0) { setZoom1(1); setOffX1(0); setOffY1(0); }
    else { setZoom2(1); setOffX2(0); setOffY2(0); }
  };

  const disableSliders = active === 1 && !gen2Base;

  /* ---------- Instagram-like card ---------- */
  const IGCard = ({ src, index }) => (
    <div className="w-[432px] rounded-xl border bg-white overflow-hidden shadow-sm">
      {/* top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-yellow-400" />
        <div className="text-sm font-semibold">jpartaustria</div>
        <div className="ml-auto opacity-50">•••</div>
      </div>

      <div className="relative" style={{ width: 432, height: 540, background: "#fff" }}>
        {src ? (
          <img src={src} alt={`slide ${index+1}`} style={{ width: 432, height: 540, objectFit: "cover" }} />
        ) : (
          <div className="w-full h-full grid place-items-center text-sm text-muted-foreground">No preview</div>
        )}

        <button
          type="button"
          aria-label="Previous"
          onClick={() => setActive((p)=> (p+1)%2)}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white grid place-items-center"
        >‹</button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => setActive((p)=> (p+1)%2)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 text-white grid place-items-center"
        >›</button>

        <div className="absolute bottom-3 w-full flex items-center justify-center gap-1">
          <div className={`w-2 h-2 rounded-full ${active===0 ? "bg-white" : "bg-white/50"}`} />
          <div className={`w-2 h-2 rounded-full ${active===1 ? "bg-white" : "bg-white/50"}`} />
        </div>

        {busy && (
          <div className="absolute inset-0 bg-black/30 grid place-items-center text-white text-sm">
            Generating…
          </div>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-4 text-xl leading-none">
          <span>♡</span><span>💬</span><span>✈️</span>
        </div>
        <div className="text-xs mt-1 text-muted-foreground">View all 1 comment</div>
      </div>
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Instagram Carousel Preview</h3>
          <Button variant="ghost" onClick={close}>Close</Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs font-medium">Staging preset</label>
              <Select
                value={presetValue}
                onValueChange={(v) => applyPreset(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a preset" />
                </SelectTrigger>
                <SelectContent className="z-[100000]">
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Extra prompt (optional)</label>
              <textarea
                className="w-full border rounded-md p-2 text-sm"
                rows={2}
                placeholder="Add lighting, mood, camera, or styling details…"
                value={extraPrompt}
                onChange={(e)=>setExtraPrompt(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium">
                Zoom {active === 0 ? "(Slide 1)" : "(Slide 2)"}
              </label>
              <input
                type="range" min="0.6" max="1.6" step="0.01"
                value={activeZoom}
                onChange={(e)=>setActiveZoom(Number(e.target.value))}
                className="w-full"
                disabled={disableSliders}
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Horizontal {active === 0 ? "(Slide 1)" : "(Slide 2)"}
              </label>
              <input
                type="range" min="-300" max="300" step="1"
                value={activeOffX}
                onChange={(e)=>setActiveOffX(Number(e.target.value))}
                className="w-full"
                disabled={disableSliders}
              />
            </div>
            <div>
              <label className="text-xs font-medium">
                Vertical {active === 0 ? "(Slide 1)" : "(Slide 2)"}
              </label>
              <input
                type="range" min="-300" max="300" step="1"
                value={activeOffY}
                onChange={(e)=>setActiveOffY(Number(e.target.value))}
                className="w-full"
                disabled={disableSliders}
              />
            </div>
          </div>

          {errMsg && <div className="text-sm text-red-600">{errMsg}</div>}

          <div className="flex items-start justify-center">
            <IGCard src={active===0 ? gen1Preview : gen2Preview} index={active} />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button onClick={async ()=>{ await buildSecond(); }} disabled={busy || !srcUrl}>
              {gen2Base ? "Re-generate AI image" : "Generate AI image"}
            </Button>
            <Button variant="outline" onClick={resetActiveView} disabled={busy}>
              Reset view (active slide)
            </Button>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={handleUse} disabled={busy || !srcUrl}>Use these 2 images</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
