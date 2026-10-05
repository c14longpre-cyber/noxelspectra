// NOXEL Spectra Vidéo — images tirées de la vidéo : capture, suggestions, miniature.

export type ThumbAspect = "original" | "16:9" | "1:1" | "9:16";
export const THUMB_SIZES: Record<Exclude<ThumbAspect, "original">, { width: number; height: number; label: string }> = {
  "16:9": { width: 1280, height: 720, label: "16:9 — YouTube, site web (1280 × 720)" },
  "1:1": { width: 1080, height: 1080, label: "1:1 — publication carrée (1080 × 1080)" },
  "9:16": { width: 1080, height: 1920, label: "9:16 — couverture de Reel / TikTok (1080 × 1920)" },
};

export type TitleStyle = {
  text: string;
  position: "top" | "center" | "bottom";
  size: number; // % de la hauteur de l'image
  color: string;
  band: boolean; // bande sombre derrière le texte
};

/** Dessine une image de la vidéo en mode « couvrir » (recadrage centré) dans les dimensions voulues. */
export function drawCover(ctx: CanvasRenderingContext2D, source: CanvasImageSource, sw: number, sh: number, w: number, h: number) {
  const s = Math.max(w / sw, h / sh);
  ctx.drawImage(source, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s);
}

/** Miniature finale : image + titre éventuel. */
export function renderThumbnail(video: HTMLVideoElement, aspect: ThumbAspect, title: TitleStyle | null): HTMLCanvasElement {
  const sw = video.videoWidth, sh = video.videoHeight;
  const size = aspect === "original" ? { width: sw, height: sh } : THUMB_SIZES[aspect];
  const c = document.createElement("canvas");
  c.width = size.width;
  c.height = size.height;
  const ctx = c.getContext("2d")!;
  drawCover(ctx, video, sw, sh, c.width, c.height);
  if (title && title.text.trim()) drawTitle(ctx, c.width, c.height, title);
  return c;
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number, t: TitleStyle) {
  const fontSize = Math.round((h * t.size) / 100);
  ctx.font = `800 ${fontSize}px Inter, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Retour à la ligne automatique (au plus 3 lignes)
  const maxW = w * 0.88;
  const words = t.text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);
  const lh = fontSize * 1.15;
  const blockH = shown.length * lh;
  const cy = t.position === "top" ? h * 0.08 + blockH / 2 : t.position === "bottom" ? h * 0.92 - blockH / 2 : h / 2;
  if (t.band) {
    const pad = fontSize * 0.45;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "rgba(7, 9, 15, 0.82)");
    g.addColorStop(1, "rgba(20, 10, 35, 0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, cy - blockH / 2 - pad, w, blockH + pad * 2);
    ctx.fillStyle = "#3ddc84";
    ctx.fillRect(0, cy - blockH / 2 - pad, w, Math.max(2, fontSize * 0.06));
    ctx.fillStyle = "#a855f7";
    ctx.fillRect(0, cy + blockH / 2 + pad - Math.max(2, fontSize * 0.06), w, Math.max(2, fontSize * 0.06));
  }
  ctx.fillStyle = t.color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = fontSize * 0.25;
  shown.forEach((l, i) => ctx.fillText(l, w / 2, cy - blockH / 2 + lh * (i + 0.5)));
  ctx.shadowBlur = 0;
}

export const canvasToBlob = (c: HTMLCanvasElement, type: string, quality = 0.9) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("export impossible"))), type, quality));

export type FrameCandidate = { time: number; score: number; thumb: string };

/**
 * Propose les meilleures images de la sélection : on échantillonne la vidéo et on note
 * chaque image selon sa netteté (contraste local), son exposition et sa richesse en couleurs.
 * Les images noires, blanches ou floues (transitions, flou de bougé) sont écartées.
 */
export async function suggestFrames(url: string, start: number, end: number, samples = 16, keep = 6): Promise<FrameCandidate[]> {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error("lecture impossible"));
  });
  const W = 160, H = Math.max(2, Math.round((160 * v.videoHeight) / v.videoWidth));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const out: FrameCandidate[] = [];
  const span = Math.max(0.1, end - start);
  for (let i = 0; i < samples; i++) {
    const t = start + (span * (i + 0.5)) / samples;
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      v.currentTime = t;
    });
    ctx.drawImage(v, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let sum = 0, sharp = 0, sat = 0;
    const lum = new Float32Array(W * H);
    for (let p = 0, k = 0; p < d.length; p += 4, k++) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      lum[k] = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += lum[k];
      sat += Math.max(r, g, b) - Math.min(r, g, b);
    }
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const k = y * W + x;
        sharp += Math.abs(4 * lum[k] - lum[k - 1] - lum[k + 1] - lum[k - W] - lum[k + W]);
      }
    const n = W * H;
    const mean = sum / n;
    const exposure = 1 - Math.abs(mean - 128) / 128; // 1 = bien exposée, 0 = noire ou blanche
    const score = (sharp / n) * (0.3 + exposure) * (1 + sat / n / 128);
    out.push({ time: t, score: mean < 18 || mean > 240 ? 0 : score, thumb: c.toDataURL("image/jpeg", 0.7) });
  }
  v.removeAttribute("src");
  v.load();
  return out.sort((a, b) => b.score - a.score).slice(0, keep).sort((a, b) => a.time - b.time);
}

/** Durée ISO 8601 pour le JSON-LD (ex. PT2M01S). */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${r || (!h && !m) ? `${r}S` : ""}`;
}
