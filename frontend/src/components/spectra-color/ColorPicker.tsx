// Pipette : on survole l'image pour voir la couleur sous le curseur (loupe), un clic la garde.
// Tout se passe dans le navigateur : l'image n'est jamais envoyée au serveur, aucun quota.
// Clavier : la zone prend le focus, les flèches déplacent le viseur (Maj = 10 pixels), Entrée garde la couleur.
// La pipette de l'écran (API EyeDropper) n'existe que dans Chrome et Edge sur ordinateur.
import { useCallback, useEffect, useRef, useState } from "react";
import { tr } from "../../i18n";
import { formats, contraste, type Rgb } from "./colorMath";

const HISTORY_KEY = "spectra-picker-history";
const HISTORY_MAX = 12;
const LOUPE_PX = 11;     // pixels de l'image montrés dans la loupe (impair : le pixel visé au centre)
const LOUPE_SIZE = 132;  // taille de la loupe à l'écran

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

function lireHistorique(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^#[0-9a-f]{6}$/.test(x)).slice(0, HISTORY_MAX) : [];
  } catch { return []; }
}

function hexEnRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function ColorPicker({ src }: { src: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [nat, setNat] = useState({ width: 0, height: 0 });
  const [viseur, setViseur] = useState<{ x: number; y: number } | null>(null);   // en pixels de l'image
  const [loupePos, setLoupePos] = useState<{ left: number; top: number } | null>(null); // en px dans la zone
  const [survol, setSurvol] = useState<Rgb | null>(null);
  const [choisie, setChoisie] = useState<string | null>(null);
  const [historique, setHistorique] = useState<string[]>(lireHistorique);
  const [copie, setCopie] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const EyeDropper = (typeof window !== "undefined" ? (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper : undefined);

  // Image dessinée à sa taille réelle : la couleur lue est celle du fichier, pas d'un aperçu réduit.
  // Le parent passe key={src} : une nouvelle image repart d'un état vide.
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      ctxRef.current = ctx;
      setNat({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => setErreur(tr("Cette image ne peut pas être lue par le navigateur."));
    img.src = src;
  }, [src]);

  useEffect(() => {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historique)); } catch { /* stockage indisponible */ }
  }, [historique]);

  const lirePixel = useCallback((x: number, y: number): Rgb | null => {
    const ctx = ctxRef.current;
    if (!ctx) return null;
    const d = ctx.getImageData(x, y, 1, 1).data;
    // Pixel transparent : on montre la couleur stockée, comme les autres pipettes (l'opacité est ignorée)
    return [d[0], d[1], d[2]];
  }, []);

  // Loupe : agrandissement net (sans lissage) des pixels autour du viseur
  useEffect(() => {
    const l = loupeRef.current, c = canvasRef.current;
    if (!l || !c || !viseur || !nat.width) return;
    const lc = l.getContext("2d");
    if (!lc) return;
    const half = Math.floor(LOUPE_PX / 2);
    lc.imageSmoothingEnabled = false;
    lc.fillStyle = "#1a1a1a";
    lc.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    lc.drawImage(c, viseur.x - half, viseur.y - half, LOUPE_PX, LOUPE_PX, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    const cell = LOUPE_SIZE / LOUPE_PX;
    lc.strokeStyle = "#3ddc84";
    lc.lineWidth = 2;
    lc.strokeRect(half * cell, half * cell, cell, cell);
  }, [viseur, nat]);

  function placer(x: number, y: number, rect?: DOMRect) {
    const cx = Math.min(nat.width - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(nat.height - 1, Math.max(0, Math.floor(y)));
    setViseur({ x: cx, y: cy });
    setSurvol(lirePixel(cx, cy));
    const c = canvasRef.current;
    const r = rect ?? c?.getBoundingClientRect();
    if (r && nat.width) {
      const px = (cx + 0.5) * (r.width / nat.width), py = (cy + 0.5) * (r.height / nat.height);
      // La loupe se place à droite du curseur, ou à gauche près du bord
      const left = px + 18 + LOUPE_SIZE > r.width ? px - 18 - LOUPE_SIZE : px + 18;
      setLoupePos({ left, top: Math.max(0, py - LOUPE_SIZE / 2) });
    }
  }

  function depuisSouris(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    placer(((e.clientX - r.left) / r.width) * nat.width, ((e.clientY - r.top) / r.height) * nat.height, r);
  }

  function garder(hex: string) {
    setChoisie(hex);
    setHistorique((h) => [hex, ...h.filter((x) => x !== hex)].slice(0, HISTORY_MAX));
  }

  function garderViseur() {
    if (!viseur) return;
    const rgb = lirePixel(viseur.x, viseur.y);
    if (rgb) garder(formats(rgb).hex);
  }

  // Clic ou toucher : on lit le pixel sous le doigt directement (le viseur n'est peut-être pas encore à jour)
  function garderSousCurseur(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!nat.width) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(nat.width - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * nat.width)));
    const y = Math.min(nat.height - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * nat.height)));
    const rgb = lirePixel(x, y);
    if (rgb) garder(formats(rgb).hex);
  }

  function clavier(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!nat.width) return;
    const pas = e.shiftKey ? 10 : 1;
    const v = viseur ?? { x: Math.floor(nat.width / 2), y: Math.floor(nat.height / 2) };
    const dep: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
    if (dep[e.key]) { e.preventDefault(); placer(v.x + dep[e.key][0], v.y + dep[e.key][1]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!viseur) placer(v.x, v.y); else garderViseur(); }
  }

  async function pipetteEcran() {
    if (!EyeDropper) return;
    try {
      const { sRGBHex } = await new EyeDropper().open();
      // Chrome rend #rrggbb ; certaines versions rendent rgb(…) : on ramène tout en hexadécimal
      const m = sRGBHex.match(/\d+/g);
      const hex = sRGBHex.startsWith("#") ? sRGBHex.toLowerCase() : m ? formats([+m[0], +m[1], +m[2]]).hex : null;
      if (hex) garder(hex);
    } catch { /* Échap : choix annulé */ }
  }

  function copier(texte: string) {
    navigator.clipboard.writeText(texte).then(() => {
      setCopie(texte);
      setTimeout(() => setCopie(null), 1200);
    }).catch(() => setErreur(tr("Copie impossible : sélectionnez le texte et copiez-le à la main.")));
  }

  const rgbChoisie = choisie ? hexEnRgb(choisie) : null;
  const f = rgbChoisie ? formats(rgbChoisie) : null;
  const apercu = survol ? formats(survol).hex : null;

  const puce = (hex: string, actif: boolean) => (
    <button
      key={hex}
      type="button"
      onClick={() => { setChoisie(hex); copier(hex); }}
      title={tr("Choisir et copier {hex}", { hex })}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: actif ? "2px solid #3ddc84" : "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#111", cursor: "pointer", fontSize: 13, fontFamily: "monospace" }}
    >
      <span style={{ width: 16, height: 16, borderRadius: 4, background: hex, border: "1px solid rgba(0,0,0,0.15)", display: "inline-block" }} />
      {copie === hex ? tr("Copié !") : hex}
    </button>
  );

  return (
    <div>
      {EyeDropper && (
        <button type="button" onClick={pipetteEcran} style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid #A855F7", background: "transparent", color: "inherit", cursor: "pointer", fontSize: 14 }}>
          {tr("Prendre une couleur n'importe où à l'écran")}
        </button>
      )}

      {!src && <p style={{ color: "#888", fontSize: 14 }}>{tr("Choisissez une image ci-dessus, puis survolez-la : la couleur sous le curseur s'affiche, un clic la garde.")}</p>}
      {erreur && <p style={{ color: "red", fontSize: 14 }}>{erreur}</p>}

      <div style={{ display: src ? "flex" : "none", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ position: "relative", flex: "1 1 420px", maxWidth: 760, lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            tabIndex={0}
            role="img"
            aria-label={tr("Image : survolez ou utilisez les flèches pour viser un pixel, Entrée pour garder sa couleur")}
            onPointerMove={depuisSouris}
            onPointerDown={depuisSouris}
            onClick={garderSousCurseur}
            onPointerLeave={() => setLoupePos(null)}
            onKeyDown={clavier}
            style={{ width: "100%", height: "auto", cursor: "crosshair", borderRadius: 8, background: "repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 16px 16px", touchAction: "none" }}
          />
          {loupePos && viseur && (
            <div aria-hidden style={{ position: "absolute", left: loupePos.left, top: loupePos.top, width: LOUPE_SIZE, pointerEvents: "none", lineHeight: 1.2 }}>
              <canvas ref={loupeRef} width={LOUPE_SIZE} height={LOUPE_SIZE} style={{ display: "block", borderRadius: "50%", border: "3px solid #fff", boxShadow: "0 2px 10px rgba(0,0,0,.5)" }} />
              {apercu && (
                <div style={{ marginTop: 6, textAlign: "center", fontFamily: "monospace", fontSize: 13, background: "#1a1a1a", color: "#f5f5f5", borderRadius: 6, padding: "3px 0" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: apercu, marginRight: 6, verticalAlign: "middle" }} />{apercu}
                </div>
              )}
            </div>
          )}
          {nat.width > 0 && (
            <p style={{ color: "#888", fontSize: 12, marginTop: 8, lineHeight: 1.4 }}>
              {viseur ? tr("Pixel {x}, {y} sur {w} × {h}", { x: viseur.x, y: viseur.y, w: nat.width, h: nat.height }) : tr("{w} × {h} pixels", { w: nat.width, h: nat.height })}
              {" · "}{tr("L'image reste dans votre navigateur.")}
            </p>
          )}
        </div>

        <div style={{ flex: "0 1 300px", minWidth: 240 }}>
          {f && rgbChoisie ? (
            <>
              <div style={{ height: 72, borderRadius: 8, background: f.hex, border: "1px solid rgba(255,255,255,.15)" }} />
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {[["HEX", f.hex], ["RGB", f.rgb], ["HSL", f.hsl]].map(([nom, val]) => (
                  <button key={nom} type="button" onClick={() => copier(val)} title={tr("Copier")}
                    style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", color: "#111", cursor: "pointer", fontFamily: "monospace", fontSize: 13 }}>
                    <span style={{ color: "#666" }}>{nom}</span>
                    <span>{copie === val ? tr("Copié !") : val}</span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: "#888", marginTop: 12, marginBottom: 4 }}>{tr("Lisibilité d'un texte de cette couleur :")}</p>
              {([["#ffffff", tr("Sur fond blanc :")], ["#000000", tr("Sur fond noir :")]] as const).map(([fond, nom]) => {
                const r = contraste(rgbChoisie, hexEnRgb(fond));
                return (
                  <div key={fond} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 4 }}>
                    <span style={{ background: fond, color: f.hex, border: "1px solid #888", borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>Aa</span>
                    <span>{nom} {r.toFixed(2)}:1 · {r >= 4.5 ? tr("conforme (AA)") : r >= 3 ? tr("gros texte seulement") : tr("trop faible")}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <p style={{ color: "#888", fontSize: 14 }}>{tr("Aucune couleur gardée pour l'instant.")}</p>
          )}
        </div>
      </div>

      {historique.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
            {tr("Couleurs gardées (clic = copier)")}
            <button type="button" onClick={() => setHistorique([])} style={{ marginLeft: 12, background: "none", border: "none", color: "#A855F7", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>{tr("Vider la liste")}</button>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {historique.map((h) => puce(h, h === choisie))}
          </div>
        </div>
      )}
    </div>
  );
}
