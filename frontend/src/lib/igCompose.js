const CANVAS_W = 1080;
const CANVAS_H = 1350;

function averageColor(img, sample = 12) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  c.width = sample; c.height = sample;
  ctx.drawImage(img, 0, 0, sample, sample);
  const data = ctx.getImageData(0, 0, sample, sample).data;
  let r=0,g=0,b=0, n=sample*sample;
  for (let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
  r=Math.round(r/n); g=Math.round(g/n); b=Math.round(b/n);
  return `rgb(${r}, ${g}, ${b})`;
}
function drawRoundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

export async function composeForInstagram(fileOrBlob, opts = {}) {
  const {
    background = "blur",
    bgColor,
    gradient = null,
    enableFrame = true,
    frameColor = "#ffffff",
    framePadding = 44,
    frameRadius = 28,
    enableBorder = false,
    borderWidth = 1,
    borderColor = "#e5e7eb",
    imagePadding = 20,
    safeMargin = 60,
    shadow = true,
    tilt = 0,
    zoom = 1.0,
    cardAspect = "post",
    imageOffsetY = 0,
    quality = 0.9,
  } = opts;

  const blob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([fileOrBlob]);
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(blob);
  });

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  if (background === "blur") {
    const rCanvas = CANVAS_W / CANVAS_H;
    const rImg = img.width / img.height;
    let dw, dh;
    if (rImg > rCanvas) { dh = CANVAS_H * 1.2; dw = dh * rImg; }
    else { dw = CANVAS_W * 1.2; dh = dw / rImg; }
    ctx.filter = "blur(25px)";
    ctx.drawImage(img, (CANVAS_W-dw)/2, (CANVAS_H-dh)/2, dw, dh);
    ctx.filter = "none";
  } else if (background === "gradient" && Array.isArray(gradient) && gradient.length >= 2) {
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    g.addColorStop(0, gradient[0]); g.addColorStop(1, gradient[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    ctx.fillStyle = bgColor || averageColor(img);
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  const areaW = CANVAS_W - safeMargin*2;
  const areaH = CANVAS_H - safeMargin*2;

  let cardW, cardH;
  if (cardAspect === "image") {
    const rImg = img.width / img.height;
    const rArea = areaW / areaH;
    if (rArea > rImg) { cardH = areaH; cardW = cardH * rImg; }
    else { cardW = areaW; cardH = cardW / rImg; }
  } else {
    cardW = areaW; cardH = areaH;
  }

  const card = document.createElement("canvas");
  card.width = Math.round(cardW);
  card.height = Math.round(cardH);
  const cctx = card.getContext("2d");

  if (enableFrame) {
    cctx.save();
    drawRoundedRect(cctx, 0, 0, card.width, card.height, frameRadius);
    cctx.fillStyle = frameColor; cctx.fill();
    if (enableBorder && borderWidth > 0) {
      cctx.lineWidth = borderWidth; cctx.strokeStyle = borderColor; cctx.stroke();
    }
    cctx.clip();

    const innerW = card.width - framePadding*2;
    const innerH = card.height - framePadding*2;
    const rInner = innerW / innerH;
    const rImg = img.width / img.height;

    let drawW, drawH;
    if (rImg > rInner) { drawW = innerW; drawH = drawW / rImg; }
    else { drawH = innerH; drawW = drawH * rImg; }

    const slackY = Math.max(0, innerH - drawH);
    const centerDy = framePadding + (innerH - drawH) / 2;
    const dy = centerDy + (slackY * (imageOffsetY || 0)) / 2;
    const dx = (card.width - drawW) / 2;

    cctx.drawImage(img, dx, dy, drawW, drawH);
    cctx.restore();
  } else {
    const innerW = card.width - imagePadding*2;
    const innerH = card.height - imagePadding*2;
    const rInner = innerW / innerH;
    const rImg = img.width / img.height;

    let drawW, drawH;
    if (rImg > rInner) { drawW = innerW; drawH = drawW / rImg; }
    else { drawH = innerH; drawW = drawH * rImg; }

    const slackY = Math.max(0, innerH - drawH);
    const centerDy = imagePadding + (innerH - drawH) / 2;
    const dy = centerDy + (slackY * (imageOffsetY || 0)) / 2;
    const dx = (card.width - drawW) / 2;

    if (enableBorder && borderWidth > 0) {
      const bw = borderWidth;
      cctx.fillStyle = "#ffffff";
      cctx.fillRect(dx - bw, dy - bw, drawW + 2*bw, drawH + 2*bw);
    }
    cctx.drawImage(img, dx, dy, drawW, drawH);
  }

  ctx.save();
  ctx.translate(CANVAS_W/2, CANVAS_H/2);
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
  }
  if (tilt) ctx.rotate((tilt * Math.PI) / 180);

  const drawW = Math.round(card.width * (zoom || 1));
  const drawH = Math.round(card.height * (zoom || 1));
  ctx.drawImage(card, -drawW/2, -drawH/2, drawW, drawH);
  ctx.restore();

  return await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
  );
}
