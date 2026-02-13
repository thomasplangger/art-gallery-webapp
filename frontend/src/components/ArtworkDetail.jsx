import React, { useMemo, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { AspectRatio } from "../components/ui/aspect-ratio";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { euros } from "../mock/mock";
import { useToast } from "../hooks/use-toast";
import { createCheckoutSession, trackEvent } from "../lib/api";

export default function ArtworkDetail({ open, onOpenChange, item, t }) {
  if (!open || !item) return null;

  const { toast } = useToast();

  const mainSrc = item._resolvedSrc || item.image || item.imageUrl || "";
  useEffect(() => {
    if (open && item?.id) {
      trackEvent("artwork_view", { artwork_id: item.id, path: location.pathname });
    }
  }, [open, item?.id]);

  const images = useMemo(() => {
    const extras =
      (Array.isArray(item.extraImages) && item.extraImages) ||
      (Array.isArray(item.images) && item.images) ||
      (Array.isArray(item.igImages) && item.igImages) ||
      (item.image2 ? [item.image2] : []) ||
      [];
    const all = [mainSrc, ...extras].filter(Boolean);
    return Array.from(new Set(all));
  }, [item, mainSrc]);

  const [activeIdx, setActiveIdx] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState(null);

  const ratio = useMemo(() => {
    const w = Number(item?.widthCm);
    const h = Number(item?.heightCm);
    if (w > 0 && h > 0) return w / h;
    return naturalRatio || 3 / 4;
  }, [item?.widthCm, item?.heightCm, naturalRatio]);

  const wrapRef = useRef(null);
  const imgRef = useRef(null);

  const [zoomOn, setZoomOn] = useState(false);
  const [lens, setLens] = useState({
    left: 0,
    top: 0,
    bgX: 0,
    bgY: 0,
    imgW: 1,
    imgH: 1,
  });

  const lensSize = 180;
  const zoomLevel = 2.2;

  const current = images[activeIdx];

  const onMove = (e) => {
    const cont = wrapRef.current;
    const imgEl = imgRef.current;
    if (!cont || !imgEl) return;

    const cr = cont.getBoundingClientRect();
    const ir = imgEl.getBoundingClientRect();

    const cx = Math.max(ir.left, Math.min(ir.right, e.clientX));
    const cy = Math.max(ir.top, Math.min(ir.bottom, e.clientY));

    const relX = cx - ir.left;
    const relY = cy - ir.top;

    const left = cx - cr.left - lensSize / 2;
    const top  = cy - cr.top  - lensSize / 2;

    const imgW = Math.max(1, ir.width);
    const imgH = Math.max(1, ir.height);

    const bgX = -(relX * zoomLevel - lensSize / 2);
    const bgY = -(relY * zoomLevel - lensSize / 2);

    setLens({ left, top, bgX, bgY, imgW, imgH });
  };

  const handleBuy = async () => {
    try {
      const { url } = await createCheckoutSession({ artworkId: item.id });
      if (url) window.location.href = url;
      else toast({ title: t("checkout.error"), description: "No checkout URL returned." });
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Checkout failed";
      toast({ title: t("checkout.unavailable"), description: String(msg) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="heading-serif text-2xl">{item.title}</DialogTitle>
          <DialogDescription className="sr-only">Artwork details</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div
              ref={wrapRef}
              className="rounded-md overflow-hidden border bg-white"
              onMouseEnter={() => setZoomOn(true)}
              onMouseLeave={() => setZoomOn(false)}
              onMouseMove={onMove}
            >
              <AspectRatio ratio={ratio} className="relative">
                <img
                  ref={imgRef}
                  src={current}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-contain"
                  onLoad={(e) => {
                    const iw = e.currentTarget.naturalWidth || 0;
                    const ih = e.currentTarget.naturalHeight || 0;
                    if (iw > 0 && ih > 0) setNaturalRatio(iw / ih);
                  }}
                />
                {zoomOn && current && (
                  <div
                    style={{
                      position: "absolute",
                      width: lensSize,
                      height: lensSize,
                      left: `${Math.round(lens.left)}px`,
                      top: `${Math.round(lens.top)}px`,
                      borderRadius: "999px",
                      boxShadow:
                        "0 0 0 2px rgba(255,255,255,0.9), 0 2px 12px rgba(0,0,0,0.35)",
                      backgroundImage: `url(${current})`,
                      backgroundRepeat: "no-repeat",
                      backgroundSize: `${Math.round(lens.imgW * zoomLevel)}px ${Math.round(
                        lens.imgH * zoomLevel
                      )}px`,
                      backgroundPosition: `${Math.round(lens.bgX)}px ${Math.round(lens.bgY)}px`,
                      pointerEvents: "none",
                    }}
                  />
                )}
              </AspectRatio>
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {images.map((u, i) => (
                  <button
                    key={i}
                    className={`border rounded-md overflow-hidden ${
                      i === activeIdx ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setActiveIdx(i)}
                    title={`Image ${i + 1}`}
                  >
                    <img src={u} alt={`thumb-${i}`} className="h-16 w-16 object-cover bg-white" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {typeof item.priceCents === "number" && (
              <div className="text-lg font-semibold">€ {euros(item.priceCents)}</div>
            )}

            <div className="flex flex-wrap gap-2 text-sm">
              {item.category && <Badge variant="secondary">{item.category}</Badge>}
              {item.year && <Badge variant="secondary">{item.year}</Badge>}
              {item.status && (
                <Badge variant={item.status === "sold" ? "destructive" : "secondary"}>
                  {item.status}
                </Badge>
              )}
            </div>

            {item.medium && (
              <div className="text-sm">
                <span className="font-medium">Medium: </span>
                {item.medium}
              </div>
            )}

            {item.dimensions && (
              <div className="text-sm">
                <span className="font-medium">Dimensions: </span>
                {item.dimensions}
              </div>
            )}

            {item.description && (
              <p className="text-sm leading-6 text-muted-foreground break-words whitespace-pre-wrap">
                {item.description}
              </p>
            )}

            {item.status !== "sold" && (
              <Button className="mt-2" onClick={handleBuy}>
                {t("card.buy")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
