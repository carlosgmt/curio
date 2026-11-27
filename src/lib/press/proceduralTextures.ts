import type { ArchetypeSpec, PressPalette, SpineMeta } from "./archetypes";

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(/\s+/).filter(Boolean);
  let line = "";
  let lineCount = 0;
  let curY = y;

  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lineCount++;
      if (lineCount >= maxLines) {
        ctx.fillText(line.slice(0, Math.max(3, line.length - 1)) + "…", x, curY);
        return curY + lineHeight;
      }
      ctx.fillText(line, x, curY);
      curY += lineHeight;
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, curY);
    curY += lineHeight;
  }
  return curY;
}

export function createFrontCoverCanvas(
  spec: ArchetypeSpec,
  meta: SpineMeta,
  palette: PressPalette,
  coverImage: HTMLImageElement | null
): HTMLCanvasElement {
  const w = 768;
  const h = Math.round(768 * spec.heightRatio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = palette.coverBg;
  ctx.fillRect(0, 0, w, h);

  // Fine archival weave noise
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let x = 0; x < w; x += 8) {
    ctx.fillRect(x, 0, 1, h);
  }

  // Spine hinge crease along left edge
  const crease = ctx.createLinearGradient(0, 0, 44, 0);
  crease.addColorStop(0, "rgba(0,0,0,0.34)");
  crease.addColorStop(0.55, "rgba(255,255,255,0.08)");
  crease.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = crease;
  ctx.fillRect(0, 0, 44, h);

  if (coverImage && coverImage.naturalWidth > 0 && coverImage.naturalHeight > 0) {
    if (spec.id === "archival_box" || spec.id === "linen_folio") {
      // Framed gallery plate on textured collector box / linen folio
      const pad = 64;
      const frameW = w - pad * 2;
      const frameH = Math.round(h * 0.58);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(pad - 2, 130 - 2, frameW + 4, frameH + 4);
      drawImageCover(ctx, coverImage, pad, 130, frameW, frameH);

      ctx.fillStyle = palette.coverInk;
      ctx.font = '500 18px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(
        meta.isWishlist ? `[ WISHLIST · ${spec.label.toUpperCase()} ]` : `[ ${spec.label.toUpperCase()} ]`,
        pad,
        92
      );

      ctx.font = '500 38px "Newsreader", Georgia, serif';
      drawWrappedText(ctx, meta.title, pad, 130 + frameH + 58, frameW, 46, 3);

      ctx.globalAlpha = 0.78;
      ctx.font = '500 20px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText(
        [meta.creator, meta.yearOrPrice].filter(Boolean).join(" · ").slice(0, 42),
        pad,
        h - 56
      );
      ctx.globalAlpha = 1;
    } else {
      // Full-bleed edge-to-edge jacket (Hardcover / Media Case / Vinyl Sleeve)
      drawImageCover(ctx, coverImage, 0, 0, w, h);
    // Subtle top/bottom vignette keeping artwork faithful
      const vig = ctx.createLinearGradient(0, h - 180, 0, h);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, h - 180, w, 180);
    }
    if (meta.isWishlist) {
      ctx.save();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 10]);
      ctx.strokeRect(20, 20, w - 40, h - 40);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(18, 17, 15, 0.78)";
      ctx.fillRect(36, 36, 204, 38);
      ctx.fillStyle = palette.accent;
      ctx.font = '600 16px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillText("WISHLIST STUDY", 52, 61);
      ctx.restore();
    }
  } else {
    // Pure Stripe Press typographic cloth cover when item has no hero photo
    const pad = 72;
    ctx.strokeStyle = meta.isWishlist ? palette.accent : palette.coverInk;
    ctx.globalAlpha = meta.isWishlist ? 0.65 : 0.35;
    ctx.lineWidth = meta.isWishlist ? 3 : 2;
    if (meta.isWishlist) ctx.setLineDash([12, 8]);
    ctx.strokeRect(pad - 20, pad - 20, w - (pad - 20) * 2, h - (pad - 20) * 2);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    ctx.fillStyle = palette.accent;
    ctx.font = '600 18px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(
      meta.isWishlist ? `WISHLIST · ${spec.label.toUpperCase()}` : spec.label.toUpperCase(),
      pad,
      pad + 18
    );

    ctx.fillStyle = palette.coverInk;
    ctx.font = '500 54px "Newsreader", Georgia, serif';
    const nextY = drawWrappedText(ctx, meta.title, pad, pad + 112, w - pad * 2, 64, 5);

    if (meta.subtitle) {
      ctx.globalAlpha = 0.78;
      ctx.font = 'italic 26px "Newsreader", Georgia, serif';
      drawWrappedText(ctx, meta.subtitle, pad, Math.max(nextY + 26, h * 0.56), w - pad * 2, 34, 4);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = palette.accent;
    ctx.fillRect(pad, h - 122, 72, 2);

    ctx.fillStyle = palette.coverInk;
    ctx.font = '500 22px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillText(meta.creator.toUpperCase().slice(0, 34), pad, h - 76);
  }

  return canvas;
}

export function createSpineCanvas(
  spec: ArchetypeSpec,
  meta: SpineMeta,
  palette: PressPalette
): HTMLCanvasElement {
  const w = 256;
  const h = Math.round(1280 * spec.heightRatio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = palette.coverBg;
  ctx.fillRect(0, 0, w, h);

  // Subtle woven cloth cross-grain along spine
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 1);
  }

  // Rounded buckram spine edge shading
  const spineGrad = ctx.createLinearGradient(0, 0, w, 0);
  spineGrad.addColorStop(0, "rgba(0,0,0,0.34)");
  spineGrad.addColorStop(0.16, "rgba(255,255,255,0.10)");
  spineGrad.addColorStop(0.5, "rgba(255,255,255,0.03)");
  spineGrad.addColorStop(0.84, "rgba(0,0,0,0.06)");
  spineGrad.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = spineGrad;
  ctx.fillRect(0, 0, w, h);

  // Select among 4 Swiss/literary spine rule templates deterministically
  let hash = 0;
  for (let i = 0; i < meta.title.length; i++) {
    hash = (hash * 31 + meta.title.charCodeAt(i)) | 0;
  }
  const variant = Math.abs(hash) % 4;

  // Editorial foil head and tail rules
  ctx.fillStyle = palette.accent;
  ctx.globalAlpha = 0.72;
  if (variant === 0 || variant === 2) {
    ctx.fillRect(32, 58, w - 64, 4);
    ctx.fillRect(32, h - 62, w - 64, 4);
  }
  if (variant === 1) {
    ctx.fillRect(32, 72, w - 64, 2);
    ctx.fillRect(32, 82, w - 64, 6);
    ctx.fillRect(32, h - 84, w - 64, 6);
    ctx.fillRect(32, h - 70, w - 64, 2);
  } else if (variant === 3) {
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 44, w - 48, h - 88);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = palette.coverInk;
  ctx.textBaseline = "middle";
  ctx.font = '500 44px "Newsreader", Georgia, serif';
  ctx.textAlign = "left";
  const spineTitle = meta.isWishlist ? `WISHLIST · ${meta.title}` : meta.title;
  const maxTitleChars = 30;
  const displayTitle =
    spineTitle.length > maxTitleChars
      ? `${spineTitle.slice(0, maxTitleChars - 1)}…`
      : spineTitle;
  ctx.fillText(displayTitle, -h * 0.36, variant === 2 ? -10 : -4);

  ctx.fillStyle = palette.accent;
  ctx.font = '500 24px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textAlign = "right";
  ctx.fillText(meta.creator.toUpperCase().slice(0, 18), h * 0.37, variant === 2 ? 12 : 2);
  ctx.restore();

  return canvas;
}

export function createBumpCanvas(kind: ArchetypeSpec["materialKind"]): HTMLCanvasElement {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  if (kind === "buckram" || kind === "linen") {
    const step = kind === "buckram" ? 3 : 5;
    for (let y = 0; y < size; y += step) {
      ctx.fillStyle = y % (step * 2) === 0 ? "#969696" : "#6a6a6a";
      ctx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += step) {
      ctx.fillStyle = x % (step * 2) === 0 ? "rgba(170,170,170,0.45)" : "rgba(85,85,85,0.45)";
      ctx.fillRect(x, 0, 1, size);
    }
  } else if (kind === "paperboard" || kind === "matte_vinyl") {
    for (let y = 0; y < size; y += 3) {
      for (let x = 0; x < size; x += 3) {
        const v = 120 + (((x * 37 + y * 91) % 19) - 9);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
  return canvas;
}

export function createPageBlockCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#EFE9DC";
  ctx.fillRect(0, 0, 160, 640);
  for (let x = 0; x < 160; x += 3) {
    ctx.fillStyle = x % 6 === 0 ? "rgba(24,20,14,0.08)" : "rgba(255,255,255,0.28)";
    ctx.fillRect(x, 0, 1, 640);
  }
  const depthVignette = ctx.createLinearGradient(0, 0, 160, 0);
  depthVignette.addColorStop(0, "rgba(0,0,0,0.14)");
  depthVignette.addColorStop(0.5, "rgba(0,0,0,0)");
  depthVignette.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = depthVignette;
  ctx.fillRect(0, 0, 160, 640);
  return canvas;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const ir = img.naturalWidth / img.naturalHeight;
  const br = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (ir > br) {
    sw = img.naturalHeight * br;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / br;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
