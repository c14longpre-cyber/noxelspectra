// NOXEL Spectra — outil Dégradé (calques, 11 géométries, répétition, fusion)
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  ADD_ONS, BLEND_MODES, GEO_TYPES, MAX_LAYERS, MAX_STOPS, MIN_STOPS, NATIVE_CSS, PRESETS,
  docToCss, docToSvg, makeLayer, newId, normalizeDoc,
} from "./gradient-engine";
import type { BlendMode, GeoType, GradientDoc, Layer, RepeatMode, Stop } from "./gradient-engine";
import { composeDoc, layerDataUrl, loadLibrary, saveLibrary } from "./gradient-render";
import "./gradient-hud.css";
import { HudButton } from "../hud/HudButton";

const PREVIEW_MAX = 640;
const PREVIEW_DRAG = 300; // aperçu allégé pendant un glisser, pleine qualité au relâchement
const SIZES: [string, number, number][] = [
  ["1200 × 630 (partage)", 1200, 630],
  ["1920 × 1080", 1920, 1080],
  ["1080 × 1080", 1080, 1080],
  ["1080 × 1920 (story)", 1080, 1920],
];
const CENTERED: GeoType[] = ["radial", "diamond", "square", "conic", "conic-symmetric", "spiral-cw", "spiral-ccw"];
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const download = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

type Handle = { key: string; x: number; y: number; color: string; title: string };

// Vignette d'un ensemble de calques (préréglages, liste des calques)
function thumb(layers: Layer[], w: number, h: number): string {
  try {
    return composeDoc({ version: 2, width: w, height: h, layers }, w, h).toDataURL("image/png");
  } catch {
    return "";
  }
}
// Barre d'aperçu des couleurs d'un calque
function stopsCss(stops: Stop[]): string {
  const s = stops.slice().sort((a, b) => a.position - b.position);
  return `linear-gradient(90deg, ${s.map((st) => {
    const r = parseInt(st.color.slice(1, 3), 16), g = parseInt(st.color.slice(3, 5), 16), b = parseInt(st.color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${st.opacity / 100}) ${st.position}%`;
  }).join(", ")})`;
}

export function GradientTool() {
  const [doc, setDoc] = useState<GradientDoc>(() => normalizeDoc({ width: 1200, height: 630, layers: [makeLayer({ name: "Dégradé", x1: 0, y1: 0, x2: 100, y2: 100 })] }));
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [cssOut, setCssOut] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragKey = useRef<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const frame = useRef<number | null>(null);

  const layer = doc.layers.find((l) => l.id === selectedId) || doc.layers[doc.layers.length - 1];
  const scale = Math.min(1, (dragging ? PREVIEW_DRAG : PREVIEW_MAX) / Math.max(doc.width, doc.height));
  const pw = Math.max(16, Math.round(doc.width * scale));
  const ph = Math.max(16, Math.round(doc.height * scale));

  // Aperçu : recalcul à la prochaine image disponible
  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (canvasRef.current) composeDoc(doc, pw, ph, canvasRef.current);
    });
  }, [doc, pw, ph]);

  // ── Modifications ──────────────────────────────────────────────────
  const update = (patch: Partial<Layer>) =>
    setDoc((d) => ({ ...d, layers: d.layers.map((l) => (l.id === layer.id ? { ...l, ...patch } : l)) }));
  const setStops = (stops: Stop[]) => update({ stops });
  const loadLayers = (layers: Layer[]) => {
    setDoc((d) => ({ ...d, layers }));
    setSelectedId(layers[layers.length - 1].id);
    setCssOut(null);
  };

  function addLayer(l?: Layer) {
    if (doc.layers.length >= MAX_LAYERS) return setStatus(`${MAX_LAYERS} calques maximum.`);
    const nl = l || makeLayer({ name: `Calque ${doc.layers.length + 1}`, type: "radial", blend: "screen", stops: [
      { position: 0, color: "#ffffff", opacity: 70 }, { position: 100, color: "#ffffff", opacity: 0 },
    ] });
    setDoc((d) => ({ ...d, layers: [...d.layers, nl] }));
    setSelectedId(nl.id);
  }
  function duplicateLayer() {
    if (doc.layers.length >= MAX_LAYERS) return setStatus(`${MAX_LAYERS} calques maximum.`);
    const copy = { ...structuredClone(layer), id: newId(), name: `${layer.name} (copie)` };
    setDoc((d) => {
      const i = d.layers.findIndex((l) => l.id === layer.id);
      const layers = d.layers.slice();
      layers.splice(i + 1, 0, copy);
      return { ...d, layers };
    });
    setSelectedId(copy.id);
  }
  function removeLayer() {
    if (doc.layers.length <= 1) return;
    setDoc((d) => ({ ...d, layers: d.layers.filter((l) => l.id !== layer.id) }));
    setSelectedId("");
  }
  function moveLayer(dir: 1 | -1) {
    setDoc((d) => {
      const i = d.layers.findIndex((l) => l.id === layer.id);
      const j = i + dir;
      if (j < 0 || j >= d.layers.length) return d;
      const layers = d.layers.slice();
      [layers[i], layers[j]] = [layers[j], layers[i]];
      return { ...d, layers };
    });
  }

  function addStop() {
    if (layer.stops.length >= MAX_STOPS) return;
    const s = layer.stops.slice().sort((a, b) => a.position - b.position);
    let gi = 0;
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1].position - s[i].position > s[gi + 1].position - s[gi].position) gi = i;
    setStops([...layer.stops, { position: Math.round((s[gi].position + s[gi + 1].position) / 2), color: s[gi].color, opacity: 100 }]);
  }
  const reverseStops = () => setStops(layer.stops.map((s) => ({ ...s, position: 100 - s.position })));
  const spreadStops = () => {
    const s = layer.stops.slice().sort((a, b) => a.position - b.position);
    setStops(s.map((st, i) => ({ ...st, position: Math.round((i / (s.length - 1)) * 100) })));
  };

  // ── Poignées sur l'aperçu ─────────────────────────────────────────
  const minSide = Math.min(doc.width, doc.height);
  const handles: Handle[] = useMemo(() => {
    const l = layer;
    if (l.type === "linear" || l.type === "reflected")
      return [
        { key: "p1", x: l.x1, y: l.y1, color: "#3ddc84", title: l.type === "reflected" ? "Axe" : "Départ" },
        { key: "p2", x: l.x2, y: l.y2, color: "#a855f7", title: "Arrivée" },
      ];
    if (l.type === "freeform") return l.points.map((p, i) => ({ key: `pt${i}`, x: p.x, y: p.y, color: p.color, title: `Point ${i + 1}` }));
    if (CENTERED.includes(l.type)) {
      const hs: Handle[] = [{ key: "c", x: l.cx, y: l.cy, color: "#3ddc84", title: "Centre" }];
      if (l.type === "conic" || l.type === "conic-symmetric") {
        const a = ((l.angle - 90) * Math.PI) / 180;
        hs.push({ key: "ang", x: l.cx + (Math.cos(a) * 20 * minSide) / doc.width, y: l.cy + (Math.sin(a) * 20 * minSide) / doc.height, color: "#a855f7", title: "Angle de départ" });
      } else if (l.shape === "ellipse" && l.type !== "spiral-cw" && l.type !== "spiral-ccw") {
        hs.push({ key: "rx", x: l.cx + l.rx, y: l.cy, color: "#a855f7", title: "Rayon horizontal" });
        hs.push({ key: "ry", x: l.cx, y: l.cy + l.ry, color: "#a855f7", title: "Rayon vertical" });
      } else {
        hs.push({ key: "r", x: l.cx + (l.rx * minSide) / doc.width, y: l.cy, color: "#a855f7", title: "Rayon" });
      }
      return hs;
    }
    return [];
  }, [layer, doc.width, doc.height, minSide]);

  function pointerToPct(e: ReactPointerEvent) {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }
  function onDrag(e: ReactPointerEvent) {
    const k = dragKey.current;
    if (!k) return;
    const { x, y } = pointerToPct(e);
    const px = clamp(Math.round(x * 10) / 10, -50, 150);
    const py = clamp(Math.round(y * 10) / 10, -50, 150);
    if (k === "p1") update({ x1: px, y1: py });
    else if (k === "p2") update({ x2: px, y2: py });
    else if (k === "c") update({ cx: px, cy: py });
    else if (k === "rx") update({ rx: clamp(Math.abs(px - layer.cx), 1, 300) });
    else if (k === "ry") update({ ry: clamp(Math.abs(py - layer.cy), 1, 300) });
    else if (k === "r") {
      const dx = ((px - layer.cx) / 100) * doc.width, dy = ((py - layer.cy) / 100) * doc.height;
      update({ rx: clamp(Math.round((Math.hypot(dx, dy) / minSide) * 1000) / 10, 1, 300) });
    } else if (k === "ang") {
      const dx = ((px - layer.cx) / 100) * doc.width, dy = ((py - layer.cy) / 100) * doc.height;
      update({ angle: Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360) });
    } else if (k.startsWith("pt")) {
      const i = Number(k.slice(2));
      update({ points: layer.points.map((p, j) => (j === i ? { ...p, x: clamp(px, 0, 100), y: clamp(py, 0, 100) } : p)) });
    }
  }

  // ── Exports ─────────────────────────────────────────────────────────
  async function exportPng() {
    setStatus("Rendu PNG en cours…");
    await new Promise((r) => setTimeout(r, 30));
    composeDoc(doc, doc.width, doc.height).toBlob((b) => {
      if (b) download(b, "noxel-degrade.png");
      setStatus(`PNG ${doc.width} × ${doc.height} exporté.`);
    }, "image/png");
  }
  function exportSvg() {
    const { svg, rasterized } = docToSvg(doc, (l) => layerDataUrl(l, doc.width, doc.height));
    download(new Blob([svg], { type: "image/svg+xml" }), "noxel-degrade.svg");
    setStatus(
      rasterized.length
        ? `SVG exporté. Intégrés en image (pas de géométrie SVG native) : ${rasterized.join(", ")}.`
        : "SVG exporté — entièrement vectoriel."
    );
  }
  function exportCss() {
    const { css, skipped } = docToCss(doc);
    setCssOut(css);
    navigator.clipboard?.writeText(css).catch(() => undefined);
    setStatus(skipped.length ? "CSS copié — certains calques ne sont pas représentables en CSS (voir le commentaire)." : "CSS copié — rendu identique à l'aperçu.");
  }
  const exportJson = () => download(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }), "noxel-degrade.json");
  async function importJson(file: File | null) {
    if (!file) return;
    try {
      const d = normalizeDoc(JSON.parse(await file.text()));
      setDoc(d);
      setSelectedId(d.layers[d.layers.length - 1].id);
      setStatus("Dégradé importé.");
    } catch {
      setStatus("Fichier JSON invalide.");
    }
  }
  function sendToEditor() {
    const name = window.prompt("Nom du dégradé (visible dans l'Éditeur) :", layer.name || "Mon dégradé");
    if (!name) return;
    const list = loadLibrary().filter((g) => g.name !== name.trim());
    const ok = saveLibrary([{ id: newId(), name: name.trim().slice(0, 40), doc }, ...list]);
    setStatus(ok ? `« ${name.trim()} » est enregistré dans ta bibliothèque de dégradés (dans ce navigateur).` : "Enregistrement impossible dans ce navigateur.");
  }

  const nonNativeCss = doc.layers.filter((l) => l.visible && !NATIVE_CSS.includes(l.type)).length;
  const num = (v: number, set: (n: number) => void, min: number, max: number, step = 1) => (
    <input type="number" value={v} min={min} max={max} step={step} onChange={(e) => set(clamp(Number(e.target.value) || 0, min, max))} style={{ width: "100%", marginTop: 4 }} />
  );
  const isRadialLike = CENTERED.includes(layer.type) && layer.type !== "conic" && layer.type !== "conic-symmetric";
  const presetThumbs = useMemo(() => PRESETS.map((p) => ({ ...p, img: thumb(p.build(), 160, 90) })), []);
  const layerThumbs = useMemo(() => {
    const m: Record<string, string> = {};
    for (const l of doc.layers) m[l.id] = thumb([{ ...l, opacity: 100, blend: "normal" }], 40, 24);
    return m;
  }, [doc.layers]);

  return (
    <div className="nx-grid">
      {/* ── Colonne aperçu ── */}
      <div style={{ position: "sticky", top: 12 }}>
        <section className="nx-panel">
          <h3 className="nx-head"><b>01</b> / Aperçu</h3>
          <div className="nx-viewport-wrap">
            <i /><i /><i /><i />
            <div
              ref={boxRef}
              className="nx-viewport"
              onPointerMove={onDrag}
              onPointerUp={() => { dragKey.current = null; setDragging(false); }}
              onPointerLeave={() => { dragKey.current = null; setDragging(false); }}
              style={{ aspectRatio: `${doc.width} / ${doc.height}` }}
            >
              <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
              {(layer.type === "linear" || layer.type === "reflected") && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  <line x1={layer.x1} y1={layer.y1} x2={layer.x2} y2={layer.y2} stroke="#fff" strokeWidth="1.5" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity="0.85" />
                </svg>
              )}
              {handles.map((h) => (
                <div
                  key={h.key}
                  className="nx-handle"
                  title={h.title}
                  role="slider"
                  aria-label={h.title}
                  aria-valuenow={Math.round(h.x)}
                  tabIndex={0}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragKey.current = h.key;
                    setDragging(true);
                  }}
                  onPointerMove={onDrag}
                  onPointerUp={() => { dragKey.current = null; setDragging(false); }}
                  style={{ left: `${h.x}%`, top: `${h.y}%`, background: h.color, color: h.color }}
                />
              ))}
            </div>
          </div>
          <div className="nx-readout">
            <span>{doc.width} × {doc.height} PX · {doc.layers.length} CALQUE(S)</span>
            <span className="nx-live">{dragging ? "ÉDITION" : "EN DIRECT"}</span>
          </div>
          {handles.length > 0 && <p className="nx-note" style={{ color: "#7f93a8" }}>Déplace les points directement sur l'aperçu.</p>}
        </section>

        <section className="nx-panel">
          <h3 className="nx-head"><b>07</b> / Export</h3>
          <div className="nx-row">
            <HudButton action="gradient-png" compact onClick={exportPng} />
            <HudButton action="gradient-svg" compact onClick={exportSvg} />
            <HudButton action="gradient-css" compact onClick={exportCss} />
            <HudButton action="gradient-json" compact onClick={exportJson} />
            <HudButton action="gradient-import" compact onClick={() => importRef.current?.click()} />
            <HudButton action="gradient-save" compact onClick={sendToEditor} />
            <input ref={importRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { importJson(e.target.files?.[0] || null); e.target.value = ""; }} />
          </div>
          {nonNativeCss > 0 && (
            <p className="nx-note is-warn">
              {nonNativeCss} calque(s) utilisent une géométrie sans équivalent CSS : le PNG est exact ; le SVG les intègre en image.
            </p>
          )}
          {status && <p className="nx-note is-ok">{status}</p>}
          {cssOut && <pre className="nx-code">{cssOut}</pre>}
        </section>
      </div>

      {/* ── Colonne réglages ── */}
      <div>
        <section className="nx-panel">
          <h3 className="nx-head"><b>02</b> / Préréglages</h3>
          <div className="nx-presets">
            {presetThumbs.map((p) => (
              <button key={p.id} type="button" className="nx-preset" onClick={() => loadLayers(p.build())} aria-label={`Préréglage ${p.name}`}>
                {p.img && <img src={p.img} alt="" />}
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="nx-row" style={{ marginTop: 10 }}>
            <HudButton action="add-vignette" compact label="+ Vignette" onClick={() => addLayer(ADD_ONS[0].build())} />
            <HudButton action="add-grain" compact label="+ Grain" onClick={() => addLayer(ADD_ONS[1].build())} />
            <HudButton action="add-halo" compact label="+ Halo" onClick={() => addLayer(ADD_ONS[2].build())} />
          </div>
        </section>

        <section className="nx-panel">
          <h3 className="nx-head"><b>03</b> / Format</h3>
          <div className="controls-grid">
            <label>Largeur (px){num(doc.width, (n) => setDoc((d) => ({ ...d, width: Math.round(n) })), 16, 4096)}</label>
            <label>Hauteur (px){num(doc.height, (n) => setDoc((d) => ({ ...d, height: Math.round(n) })), 16, 4096)}</label>
          </div>
          <div className="nx-row" style={{ marginTop: 8, gap: 6 }}>
            {SIZES.map(([label, w, h]) => (
              <button key={label} type="button" className="nx-chip" aria-pressed={doc.width === w && doc.height === h}
                onClick={() => setDoc((d) => ({ ...d, width: w, height: h }))}>{label}</button>
            ))}
          </div>
        </section>

        <section className="nx-panel">
          <h3 className="nx-head"><b>04</b> / Calques</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {doc.layers.slice().reverse().map((l) => (
              <div key={l.id} className={`nx-layer${l.id === layer.id ? " is-active" : ""}${l.visible ? "" : " is-hidden"}`} onClick={() => setSelectedId(l.id)}>
                <input type="checkbox" checked={l.visible} aria-label={`Afficher ${l.name}`} onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDoc((d) => ({ ...d, layers: d.layers.map((x) => (x.id === l.id ? { ...x, visible: e.target.checked } : x)) }))} />
                {layerThumbs[l.id] ? <img className="nx-layer-thumb" src={layerThumbs[l.id]} alt="" /> : <span className="nx-layer-thumb" />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</div>
                  <div className="nx-layer-meta">
                    {GEO_TYPES.find((g) => g.id === l.type)?.label.split(" (")[0].toUpperCase()} · {BLEND_MODES.find(([b]) => b === l.blend)?.[1].toUpperCase()} · {l.opacity}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="nx-row" style={{ marginTop: 8 }}>
            <HudButton action="add-layer" compact label="+ Calque" disabled={doc.layers.length >= MAX_LAYERS} onClick={() => addLayer()} />
            <HudButton action="duplicate-layer" compact disabled={doc.layers.length >= MAX_LAYERS} onClick={duplicateLayer} />
            <HudButton action="layer-up" iconOnly disabled={doc.layers.findIndex((l) => l.id === layer.id) >= doc.layers.length - 1} onClick={() => moveLayer(1)} />
            <HudButton action="layer-down" iconOnly disabled={doc.layers.findIndex((l) => l.id === layer.id) <= 0} onClick={() => moveLayer(-1)} />
            <HudButton action="delete-layer" compact disabled={doc.layers.length <= 1} onClick={removeLayer} />
          </div>
        </section>

        <section className="nx-panel">
          <h3 className="nx-head"><b>05</b> / Calque « {layer.name || "sans nom"} »</h3>
          <div className="controls-grid">
            <label>Nom<input type="text" value={layer.name} maxLength={40} onChange={(e) => update({ name: e.target.value })} style={{ width: "100%", marginTop: 4 }} /></label>
            <label>
              Type
              <select value={layer.type} onChange={(e) => update({ type: e.target.value as GeoType })} style={{ width: "100%", marginTop: 4 }}>
                {["Base", "Formes", "Plusieurs points"].map((g) => (
                  <optgroup key={g} label={g}>
                    {GEO_TYPES.filter((t) => t.group === g).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {layer.type !== "four-corners" && layer.type !== "freeform" && layer.type !== "conic" && layer.type !== "conic-symmetric" && (
              <label>
                Répétition
                <select value={layer.repeat} onChange={(e) => update({ repeat: e.target.value as RepeatMode })} style={{ width: "100%", marginTop: 4 }}>
                  <option value="none">Aucune</option>
                  <option value="repeat">Répétée</option>
                  <option value="reflect">Aller-retour</option>
                </select>
              </label>
            )}
            <label>
              Mode de fusion
              <select value={layer.blend} onChange={(e) => update({ blend: e.target.value as BlendMode })} style={{ width: "100%", marginTop: 4 }}>
                {BLEND_MODES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label>Opacité : {layer.opacity}%<input type="range" min={0} max={100} value={layer.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} style={{ width: "100%" }} /></label>
            <label>Grain : {layer.grain === 0 ? "aucun" : `${layer.grain}%`}<input type="range" min={0} max={100} value={layer.grain} onChange={(e) => update({ grain: Number(e.target.value) })} style={{ width: "100%" }} /></label>
          </div>

          <div className="controls-grid" style={{ marginTop: 12 }}>
            {(layer.type === "linear" || layer.type === "reflected") && (
              <>
                <label>{layer.type === "reflected" ? "Axe" : "Départ"} X (%){num(layer.x1, (n) => update({ x1: n }), -100, 200, 0.5)}</label>
                <label>{layer.type === "reflected" ? "Axe" : "Départ"} Y (%){num(layer.y1, (n) => update({ y1: n }), -100, 200, 0.5)}</label>
                <label>Arrivée X (%){num(layer.x2, (n) => update({ x2: n }), -100, 200, 0.5)}</label>
                <label>Arrivée Y (%){num(layer.y2, (n) => update({ y2: n }), -100, 200, 0.5)}</label>
              </>
            )}
            {CENTERED.includes(layer.type) && (
              <>
                <label>Centre X (%){num(layer.cx, (n) => update({ cx: n }), -100, 200, 0.5)}</label>
                <label>Centre Y (%){num(layer.cy, (n) => update({ cy: n }), -100, 200, 0.5)}</label>
              </>
            )}
            {isRadialLike && (
              <>
                {layer.type !== "spiral-cw" && layer.type !== "spiral-ccw" && (
                  <label>
                    Forme
                    <select value={layer.shape} onChange={(e) => update({ shape: e.target.value as "circle" | "ellipse" })} style={{ width: "100%", marginTop: 4 }}>
                      <option value="circle">Cercle</option>
                      <option value="ellipse">Ellipse</option>
                    </select>
                  </label>
                )}
                <label>{layer.shape === "ellipse" ? "Rayon horizontal (% largeur)" : "Rayon (% du petit côté)"}{num(layer.rx, (n) => update({ rx: n }), 1, 300, 0.5)}</label>
                {layer.shape === "ellipse" && layer.type !== "spiral-cw" && layer.type !== "spiral-ccw" && (
                  <label>Rayon vertical (% hauteur){num(layer.ry, (n) => update({ ry: n }), 1, 300, 0.5)}</label>
                )}
              </>
            )}
            {(layer.type === "conic" || layer.type === "conic-symmetric" || layer.type === "spiral-cw" || layer.type === "spiral-ccw") && (
              <label>Angle de départ (°){num(layer.angle, (n) => update({ angle: n }), -360, 360)}</label>
            )}
            {(layer.type === "spiral-cw" || layer.type === "spiral-ccw") && (
              <label>Enroulements{num(layer.turns, (n) => update({ turns: n }), 0, 20, 0.5)}</label>
            )}
          </div>
        </section>

        <section className="nx-panel">
          {layer.type === "four-corners" ? (
            <>
              <h3 className="nx-head"><b>06</b> / Couleurs des coins</h3>
              <div className="controls-grid">
                {["Haut gauche", "Haut droite", "Bas droite", "Bas gauche"].map((label, i) => (
                  <label key={label}>
                    {label}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                      <input type="color" value={layer.corners[i].color} aria-label={`Couleur ${label}`} onChange={(e) => update({ corners: layer.corners.map((c, j) => (j === i ? { ...c, color: e.target.value } : c)) as Layer["corners"] })} />
                      <input type="number" min={0} max={100} value={layer.corners[i].opacity} title="Opacité (%)" aria-label={`Opacité ${label}`} style={{ width: 64 }}
                        onChange={(e) => update({ corners: layer.corners.map((c, j) => (j === i ? { ...c, opacity: clamp(Number(e.target.value) || 0, 0, 100) } : c)) as Layer["corners"] })} />
                      <span style={{ fontSize: 12 }}>% α</span>
                    </div>
                  </label>
                ))}
              </div>
            </>
          ) : layer.type === "freeform" ? (
            <>
              <h3 className="nx-head"><b>06</b> / Points ({layer.points.length}/{MAX_STOPS})</h3>
              {layer.points.map((p, i) => (
                <div key={i} className="nx-stop">
                  <input type="color" value={p.color} aria-label={`Couleur du point ${i + 1}`} onChange={(e) => update({ points: layer.points.map((q, j) => (j === i ? { ...q, color: e.target.value } : q)) })} />
                  <div className="nx-stop-fields">
                    <label>OPACITÉ %<input type="number" min={0} max={100} value={p.opacity} style={{ width: "100%" }} onChange={(e) => update({ points: layer.points.map((q, j) => (j === i ? { ...q, opacity: clamp(Number(e.target.value) || 0, 0, 100) } : q)) })} /></label>
                    <label>INFLUENCE<input type="range" min={5} max={100} value={p.influence} style={{ width: "100%" }} onChange={(e) => update({ points: layer.points.map((q, j) => (j === i ? { ...q, influence: Number(e.target.value) } : q)) })} /></label>
                  </div>
                  <HudButton action="remove-image" iconOnly label={`Retirer le point ${i + 1}`} disabled={layer.points.length <= 2} onClick={() => update({ points: layer.points.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <div className="nx-row" style={{ marginTop: 6 }}>
                <HudButton action="add-point" compact label="+ Point" disabled={layer.points.length >= MAX_STOPS}
                  onClick={() => update({ points: [...layer.points, { x: 50, y: 50, color: "#ffffff", opacity: 100, influence: 50 }] })} />
              </div>
            </>
          ) : (
            <>
              <h3 className="nx-head"><b>06</b> / Couleurs ({layer.stops.length}/{MAX_STOPS})</h3>
              <div className="nx-stops-bar" style={{ backgroundImage: `${stopsCss(layer.stops)}, repeating-conic-gradient(#2a2f3a 0% 25%, #1b1f27 0% 50%)`, backgroundSize: "100% 100%, 10px 10px" }} />
              {layer.stops.map((s, i) => (
                <div key={i} className="nx-stop">
                  <input type="color" value={s.color} onChange={(e) => setStops(layer.stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} aria-label={`Couleur ${i + 1}`} />
                  <div className="nx-stop-fields">
                    <label>POSITION %<input type="number" min={0} max={100} value={s.position} style={{ width: "100%" }} aria-label={`Position ${i + 1}`}
                      onChange={(e) => setStops(layer.stops.map((x, j) => (j === i ? { ...x, position: clamp(Number(e.target.value) || 0, 0, 100) } : x)))} /></label>
                    <label>OPACITÉ %<input type="number" min={0} max={100} value={s.opacity} style={{ width: "100%" }} aria-label={`Opacité ${i + 1}`}
                      onChange={(e) => setStops(layer.stops.map((x, j) => (j === i ? { ...x, opacity: clamp(Number(e.target.value) || 0, 0, 100) } : x)))} /></label>
                  </div>
                  <HudButton action="remove-image" iconOnly label={`Retirer la couleur ${i + 1}`} disabled={layer.stops.length <= MIN_STOPS} onClick={() => setStops(layer.stops.filter((_, j) => j !== i))} />
                </div>
              ))}
              <div className="nx-row" style={{ marginTop: 6 }}>
                <HudButton action="add-color" compact label="+ Couleur" disabled={layer.stops.length >= MAX_STOPS} onClick={addStop} />
                <HudButton action="reverse-stops" compact onClick={reverseStops} />
                <HudButton action="spread-stops" compact onClick={spreadStops} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
