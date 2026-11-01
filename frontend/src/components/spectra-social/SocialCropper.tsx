// Cadre de recadrage verrouillé au format d'un réseau social : on déplace le cadre (glisser, flèches)
// et on règle sa taille ; rien n'est jamais étiré. La zone est rendue en pixels de l'image d'origine.
// Le parent passe key={src + ratio} : un nouveau format ou une nouvelle image repart d'un cadre centré.
import { useCallback, useEffect, useRef, useState } from "react";

export type Zone = { left: number; top: number; width: number; height: number };

type Props = {
  src: string;
  ratio: number;              // largeur / hauteur voulue par le réseau
  shape?: "circle";           // affichage rond (photo de profil)
  safe?: { w: number; h: number }; // zone toujours visible, centrée, en fraction du cadre
  onChange: (zone: Zone, natural: { width: number; height: number }) => void;
  labels: { frameSize: string; moveHint: string; safeZone: string; circle: string };
};

export function SocialCropper({ src, ratio, shape, safe, onChange, labels }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [nat, setNat] = useState({ width: 0, height: 0 });
  const [taille, setTaille] = useState(100);   // % du plus grand cadre possible
  const [centre, setCentre] = useState({ x: 0.5, y: 0.5 }); // centre du cadre, en fraction de l'image
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  // Plus grand cadre au bon format qui tient dans l'image, puis réduit selon « taille »
  const cadre = useCallback(() => {
    if (!nat.width) return { w: 0, h: 0 };
    let w = nat.width, h = w / ratio;
    if (h > nat.height) { h = nat.height; w = h * ratio; }
    const k = taille / 100;
    return { w: w * k, h: h * k };
  }, [nat, ratio, taille]);

  const zone = useCallback((): Zone => {
    const { w, h } = cadre();
    const left = Math.min(Math.max(0, centre.x * nat.width - w / 2), nat.width - w);
    const top = Math.min(Math.max(0, centre.y * nat.height - h / 2), nat.height - h);
    return { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
  }, [cadre, centre, nat]);

  useEffect(() => { if (nat.width) onChange(zone(), nat); }, [zone, nat, onChange]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: centre.x, cy: centre.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    setCentre({
      x: Math.min(1, Math.max(0, drag.current.cx + (e.clientX - drag.current.x) / r.width)),
      y: Math.min(1, Math.max(0, drag.current.cy + (e.clientY - drag.current.y) / r.height)),
    });
  }
  function onKeyDown(e: React.KeyboardEvent) {
    const pas = e.shiftKey ? 0.05 : 0.01;
    const d: Record<string, [number, number]> = { ArrowLeft: [-pas, 0], ArrowRight: [pas, 0], ArrowUp: [0, -pas], ArrowDown: [0, pas] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    setCentre((c) => ({ x: Math.min(1, Math.max(0, c.x + m[0])), y: Math.min(1, Math.max(0, c.y + m[1])) }));
  }

  const z = nat.width ? zone() : null;
  const pct = (v: number, t: number) => `${(v / t) * 100}%`;

  return (
    <div className="sp-crop">
      <div ref={boxRef} className="sp-crop__box">
        <img src={src} alt="" draggable={false}
          onLoad={(e) => setNat({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} />
        {z && (
          <div
            className={`sp-crop__frame${shape === "circle" ? " sp-crop__frame--circle" : ""}`}
            style={{ left: pct(z.left, nat.width), top: pct(z.top, nat.height), width: pct(z.width, nat.width), height: pct(z.height, nat.height) }}
            role="slider" tabIndex={0} aria-label={labels.moveHint}
            aria-valuetext={`${z.left}, ${z.top}`}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            onKeyDown={onKeyDown}
          >
            {safe && (
              <div className="sp-crop__safe" title={labels.safeZone}
                style={{ left: `${(1 - safe.w) * 50}%`, top: `${(1 - safe.h) * 50}%`, width: `${safe.w * 100}%`, height: `${safe.h * 100}%` }}>
                <span>{labels.safeZone}</span>
              </div>
            )}
            {shape === "circle" && <span className="sp-crop__tag">{labels.circle}</span>}
          </div>
        )}
      </div>
      <label className="sp-crop__size">
        {labels.frameSize}
        <input type="range" min={20} max={100} value={taille} onChange={(e) => setTaille(Number(e.target.value))} />
        <span>{taille} %</span>
      </label>
      <p className="sp-crop__hint">{labels.moveHint}</p>
    </div>
  );
}
