// NOXEL Spectra — retouche du détourage au pinceau
//
// Reçoit l'image d'origine et le détourage transparent brut renvoyé par le
// serveur. Le masque (transparence) est modifiable au pinceau :
//   Effacer   → rend la zone transparente (fauteuil, mur oublié…)
//   Restaurer → fait réapparaître l'image d'origine (cheveux, épaule coupés…)
// Le fond, le recadrage au sujet et le format sont appliqués ici, dans le
// navigateur : les changer après coup est instantané.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HudButton } from "../hud/HudButton";

type Props = {
  original: File;
  cutout: Blob;
  background: string | null; // null = transparent
  trim: boolean;
  format: "png" | "webp";
  onResult: (blob: Blob) => void;
};

const MAX_UNDO_BYTES = 200 * 1024 * 1024; // mémoire max pour l'historique d'annulation
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BgRefiner({ original, cutout, background, trim, format, onResult }: Props) {
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const originalCanvas = useRef<HTMLCanvasElement | null>(null);
  const maskCanvas = useRef<HTMLCanvasElement | null>(null);
  const cutoutImg = useRef<HTMLImageElement | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const painting = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const zoomAnchor = useRef<{ fx: number; fy: number; vx: number; vy: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"erase" | "restore">("erase");
  const [brush, setBrush] = useState(40); // diamètre en pixels de l'image
  const [undoCount, setUndoCount] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number; d: number } | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [webpFallback, setWebpFallback] = useState(false);
  const [softness, setSoftness] = useState(30); // 0 = bord net (pixel par pixel), 100 = très fondu
  const [zoom, setZoom] = useState(1); // 1 = image entière à la largeur de l'écran
  const [panMode, setPanMode] = useState(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);

  // ── Chargement : image d'origine + masque initial (transparence du détourage) ──
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    undoStack.current = [];
    setUndoCount(0);
    (async () => {
      try {
        const [orig, cut] = await Promise.all([loadImage(original), loadImage(cutout)]);
        if (cancelled) return;
        const w = cut.naturalWidth;
        const h = cut.naturalHeight;

        const oc = document.createElement("canvas");
        oc.width = w;
        oc.height = h;
        // Même taille que le détourage (l'orientation EXIF est déjà appliquée des deux côtés)
        oc.getContext("2d")!.drawImage(orig, 0, 0, w, h);

        const mc = document.createElement("canvas");
        mc.width = w;
        mc.height = h;
        mc.getContext("2d")!.drawImage(cut, 0, 0);

        originalCanvas.current = oc;
        maskCanvas.current = mc;
        cutoutImg.current = cut;
        setDims({ w, h });
        // Pinceau par défaut : ~4 % du plus grand côté
        setBrush(Math.max(10, Math.round(Math.max(w, h) * 0.04)));
        setReady(true);
      } catch {
        if (!cancelled) setLoadError("Impossible de préparer la retouche de cette image.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [original, cutout]);

  // Image composée : l'origine, découpée par le masque
  function composeInto(target: HTMLCanvasElement) {
    const oc = originalCanvas.current;
    const mc = maskCanvas.current;
    if (!oc || !mc) return;
    const ctx = target.getContext("2d")!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(oc, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(mc, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  function render() {
    const view = viewRef.current;
    if (!view || !maskCanvas.current) return;
    if (view.width !== dims.w || view.height !== dims.h) {
      view.width = dims.w;
      view.height = dims.h;
    }
    composeInto(view);
  }

  function scheduleRender() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      render();
    });
  }

  // ── Résultat final : fond + recadrage + format ──
  async function exportResult() {
    if (!maskCanvas.current) return;
    const full = document.createElement("canvas");
    full.width = dims.w;
    full.height = dims.h;
    composeInto(full);

    let sx = 0;
    let sy = 0;
    let sw = dims.w;
    let sh = dims.h;
    if (trim) {
      // Boîte englobante des pixels visibles (alpha > 10)
      const data = full.getContext("2d")!.getImageData(0, 0, dims.w, dims.h).data;
      let minX = dims.w;
      let minY = dims.h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < dims.h; y++) {
        for (let x = 0; x < dims.w; x++) {
          if (data[(y * dims.w + x) * 4 + 3] > 10) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        sx = minX;
        sy = minY;
        sw = maxX - minX + 1;
        sh = maxY - minY + 1;
      }
    }

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const octx = out.getContext("2d")!;
    if (background) {
      octx.fillStyle = background;
      octx.fillRect(0, 0, sw, sh);
    }
    octx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);

    const mime = format === "webp" ? "image/webp" : "image/png";
    const blob: Blob | null = await new Promise((resolve) => out.toBlob(resolve, mime, 0.92));
    if (!blob) return;
    // Certains navigateurs (anciens Safari) ne savent pas encoder le WebP : ils rendent du PNG
    setWebpFallback(format === "webp" && blob.type !== "image/webp");
    onResult(blob);
  }

  // Premier rendu + nouvel export quand une option change
  useEffect(() => {
    if (!ready) return;
    render();
    exportResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, background, trim, format]);

  // ── Zoom et déplacement ──
  function clampZoom(z: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
  }

  // Change le zoom en gardant fixe le point de l'image situé sous (clientX, clientY)
  // — par défaut le centre de la zone visible.
  function zoomTo(next: number, clientX?: number, clientY?: number) {
    const wrap = scrollRef.current;
    const view = viewRef.current;
    const z = clampZoom(next);
    if (!wrap || !view || z === zoomRef.current) return;
    const rect = view.getBoundingClientRect();
    const wrect = wrap.getBoundingClientRect();
    const cx = clientX ?? wrect.left + wrap.clientWidth / 2;
    const cy = clientY ?? wrect.top + wrap.clientHeight / 2;
    zoomAnchor.current = {
      fx: (cx - rect.left) / rect.width,
      fy: (cy - rect.top) / rect.height,
      vx: cx - wrect.left,
      vy: cy - wrect.top,
    };
    zoomRef.current = z;
    setZoom(z);
  }

  // Après le changement de taille, on replace le défilement sur le point d'ancrage
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const wrap = scrollRef.current;
    const view = viewRef.current;
    if (!a || !wrap || !view) return;
    wrap.scrollLeft = a.fx * view.offsetWidth - a.vx;
    wrap.scrollTop = a.fy * view.offsetHeight - a.vy;
    zoomAnchor.current = null;
  }, [zoom]);

  // Ctrl + molette (et pincement du trackpad) : zoom centré sur la souris.
  // Écouteur natif non passif, sinon impossible d'empêcher le zoom de la page.
  useEffect(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // molette seule : défilement normal
      e.preventDefault();
      zoomTo(zoomRef.current * (e.deltaY < 0 ? 1.25 : 0.8), e.clientX, e.clientY);
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Barre d'espace maintenue : déplacement temporaire (comme dans Photoshop)
  useEffect(() => {
    // Seuls les vrais champs de texte gardent la barre d'espace (un curseur ou un
    // bouton qui a le focus ne doit pas bloquer le déplacement)
    const NON_TEXT = ["range", "checkbox", "radio", "color", "button", "submit", "reset", "file"];
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLTextAreaElement ||
      (t instanceof HTMLInputElement && !NON_TEXT.includes(t.type)) ||
      (t instanceof HTMLElement && t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // Empêche aussi le « clic » d'un bouton qui aurait le focus
        if (!isTyping(e.target)) e.preventDefault();
        setSpaceDown(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ── Pinceau ──
  function toImagePoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.w,
      y: ((e.clientY - rect.top) / rect.height) * dims.h,
      scale: rect.width / dims.w,
      cx: e.clientX - rect.left,
      cy: e.clientY - rect.top,
    };
  }

  function dab(x: number, y: number) {
    const ctx = maskCanvas.current!.getContext("2d")!;
    const r = brush / 2;
    ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    if (softness === 0 || r < 1.5) {
      // Bord net : travail pixel par pixel
      ctx.fillStyle = "rgba(0,0,0,1)";
      if (r < 1) {
        ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Bord fondu : la zone pleine rétrécit quand la douceur augmente
      const g = ctx.createRadialGradient(x, y, r * (1 - softness / 100), x, y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function strokeTo(x: number, y: number) {
    const last = lastPoint.current;
    if (!last) {
      dab(x, y);
    } else {
      // Points intermédiaires pour un trait continu même si la souris va vite
      const dist = Math.hypot(x - last.x, y - last.y);
      const step = Math.max(0.5, brush / 6);
      for (let d = step; d <= dist; d += step) {
        dab(last.x + ((x - last.x) * d) / dist, last.y + ((y - last.y) * d) / dist);
      }
      dab(x, y);
    }
    lastPoint.current = { x, y };
    scheduleRender();
  }

  function pushUndo() {
    const mc = maskCanvas.current!;
    const snapshot = mc.getContext("2d")!.getImageData(0, 0, mc.width, mc.height);
    const maxSnapshots = Math.max(3, Math.floor(MAX_UNDO_BYTES / snapshot.data.byteLength));
    undoStack.current.push(snapshot);
    while (undoStack.current.length > maxSnapshots) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Déplacement : bouton ✋, barre d'espace ou bouton du milieu de la souris
    if (panMode || spaceDown || e.button === 1) {
      e.preventDefault();
      const wrap = scrollRef.current;
      if (wrap) panStart.current = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
      setPanning(true);
      setCursor(null);
      return;
    }
    if (e.button !== 0) return;
    pushUndo();
    painting.current = true;
    lastPoint.current = null;
    const p = toImagePoint(e);
    strokeTo(p.x, p.y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    if (panStart.current) {
      const wrap = scrollRef.current;
      if (wrap) {
        wrap.scrollLeft = panStart.current.sl - (e.clientX - panStart.current.x);
        wrap.scrollTop = panStart.current.st - (e.clientY - panStart.current.y);
      }
      return;
    }
    if (panMode || spaceDown) {
      setCursor(null);
      return;
    }
    const p = toImagePoint(e);
    setCursor({ x: p.cx, y: p.cy, d: brush * p.scale });
    if (painting.current) strokeTo(p.x, p.y);
  }

  function endStroke() {
    if (panStart.current) {
      panStart.current = null;
      setPanning(false);
      return;
    }
    if (!painting.current) return;
    painting.current = false;
    lastPoint.current = null;
    exportResult();
  }

  function undo() {
    const snapshot = undoStack.current.pop();
    if (!snapshot || !maskCanvas.current) return;
    maskCanvas.current.getContext("2d")!.putImageData(snapshot, 0, 0);
    setUndoCount(undoStack.current.length);
    render();
    exportResult();
  }

  function resetMask() {
    const mc = maskCanvas.current;
    const cut = cutoutImg.current;
    if (!mc || !cut) return;
    pushUndo();
    const ctx = mc.getContext("2d")!;
    ctx.clearRect(0, 0, mc.width, mc.height);
    ctx.drawImage(cut, 0, 0);
    render();
    exportResult();
  }

  if (loadError) return <p style={{ color: "red", marginTop: 12 }}>{loadError}</p>;

  const maxBrush = Math.max(20, Math.round(Math.max(dims.w, dims.h) * 0.25));
  const panActive = panMode || spaceDown;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <strong style={{ fontSize: 14 }}>Retoucher :</strong>
        <HudButton action="erase" compact selected={mode === "erase" && !panMode} onClick={() => { setMode("erase"); setPanMode(false); }} />
        <HudButton action="restore" compact selected={mode === "restore" && !panMode} onClick={() => { setMode("restore"); setPanMode(false); }} />
        <HudButton action="move" compact selected={panMode} onClick={() => setPanMode((v) => !v)} title="Déplacer l'image zoomée (ou maintiens la barre d'espace)" />
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          Taille {brush}px
          <input type="range" min={1} max={maxBrush} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          Douceur {softness === 0 ? "nette" : `${softness}%`}
          <input type="range" min={0} max={100} step={5} value={softness} onChange={(e) => setSoftness(Number(e.target.value))} />
        </label>
        <HudButton action="undo-mask" compact disabled={undoCount === 0} onClick={undo} />
        <HudButton action="reset-mask" compact disabled={!ready} onClick={resetMask} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
        <strong style={{ fontSize: 14 }}>Zoom :</strong>
        <HudButton action="zoom-out" iconOnly disabled={zoom <= MIN_ZOOM} onClick={() => zoomTo(zoomRef.current / 1.5)} />
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.5}
          value={zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          aria-label="Niveau de zoom"
        />
        <HudButton action="zoom-in" iconOnly disabled={zoom >= MAX_ZOOM} onClick={() => zoomTo(zoomRef.current * 1.5)} />
        <span style={{ fontSize: 13, minWidth: 44 }}>{zoom.toFixed(zoom < 10 ? 1 : 0)}×</span>
        <HudButton action="fit" compact disabled={zoom === 1} onClick={() => zoomTo(1)} />
      </div>

      <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0" }}>
        <strong>Effacer</strong> retire ce qui reste du fond, <strong>Restaurer</strong> fait revenir une partie du
        sujet. Zoom : <strong>Ctrl + molette</strong> (centré sur la souris). Déplacement : maintiens la{" "}
        <strong>barre d'espace</strong> en glissant, ou utilise ✋. Pour le travail au pixel près : douceur nette et
        taille 1 à 3 px.
      </p>

      <div
        ref={scrollRef}
        style={{
          position: "relative",
          marginTop: 10,
          borderRadius: 8,
          border: "1px solid #ddd",
          overflow: "auto",
          maxHeight: "75vh",
          background: background || "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 20px 20px",
          lineHeight: 0,
        }}
      >
        {!ready && <p style={{ padding: 20, lineHeight: 1.4, color: "#888" }}>Préparation de la retouche...</p>}
        <div style={{ position: "relative", width: `${zoom * 100}%` }}>
          <canvas
            ref={viewRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() => {
              setCursor(null);
              endStroke();
            }}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              display: ready ? "block" : "none",
              width: "100%",
              height: "auto",
              cursor: panActive ? (panning ? "grabbing" : "grab") : "none",
              touchAction: "none",
              // Au-delà de 3×, pixels nets plutôt que flous : on voit exactement où l'on peint
              imageRendering: zoom >= 3 ? "pixelated" : "auto",
            }}
          />
          {cursor && ready && !panActive && (
            <div
              style={{
                position: "absolute",
                left: cursor.x - Math.max(cursor.d, 4) / 2,
                top: cursor.y - Math.max(cursor.d, 4) / 2,
                width: Math.max(cursor.d, 4),
                height: Math.max(cursor.d, 4),
                borderRadius: brush <= 2 ? 0 : "50%",
                border: `${cursor.d < 12 ? 1 : 2}px solid ${mode === "erase" ? "#ff5a5a" : "#3ddc84"}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </div>
      {webpFallback && (
        <p style={{ fontSize: 12, color: "#c89b3c", margin: "6px 0 0" }}>
          Ce navigateur ne sait pas encoder le WebP : le résultat est en PNG.
        </p>
      )}
    </div>
  );
}
