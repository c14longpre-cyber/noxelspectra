// NOXEL Spectra — rendu navigateur des dégradés (partagé : outil Dégradé + Éditeur)
// Chaque calque est calculé par le moteur, puis composé avec son opacité et son
// mode de fusion (les modes CSS standards sont pris en charge par le canevas).

import { renderLayerPixels } from "./gradient-engine";
import type { GradientDoc, Layer } from "./gradient-engine";

export const LIBRARY_KEY = "noxel-spectra-gradients";
export type SavedGradient = { id: string; name: string; doc: GradientDoc };

function layerCanvas(l: Layer, w: number, h: number, seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  // createImageData + set : compatible avec toutes les versions des types TypeScript
  const img = ctx.createImageData(w, h);
  img.data.set(renderLayerPixels(l, w, h, seed));
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Compose tous les calques visibles du document à la taille demandée. */
export function composeDoc(doc: GradientDoc, w: number, h: number, target?: HTMLCanvasElement): HTMLCanvasElement {
  const out = target || document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  doc.layers.forEach((l, i) => {
    if (!l.visible || l.opacity <= 0) return;
    ctx.globalAlpha = l.opacity / 100;
    ctx.globalCompositeOperation = (l.blend === "normal" ? "source-over" : l.blend) as GlobalCompositeOperation;
    ctx.drawImage(layerCanvas(l, w, h, i + 1), 0, 0);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  return out;
}

/** Un seul calque, en data URL PNG (export SVG des géométries non natives). */
export function layerDataUrl(l: Layer, w: number, h: number): string {
  return layerCanvas(l, w, h, 1).toDataURL("image/png");
}

export function loadLibrary(): SavedGradient[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveLibrary(list: SavedGradient[]): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.slice(0, 30)));
    return true;
  } catch {
    return false;
  }
}
