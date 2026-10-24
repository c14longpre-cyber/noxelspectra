// Sélecteur de police de Spectra Vidéo : même bibliothèque et même panneau que Spectra image
// (1 888 polices auto-hébergées, chaque nom affiché dans sa police), plus les polices de l'appareil.
import { useEffect, useRef } from "react";
import { ensureFont, openFontPicker } from "../../../frontend/src/components/spectra-editor/font-library";
import { FONTS, fontStack } from "../lib/overlay";

const DEVICE = FONTS.map((f) => ({ value: f.id, label: f.label, css: f.stack }));

export function FontPicker({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const device = FONTS.find((f) => f.id === value);
  useEffect(() => { if (!device) ensureFont(value).catch(() => {}); }, [value, device]);
  return (
    <button
      ref={btn}
      type="button"
      className="vx-font-btn"
      aria-haspopup="listbox"
      title={device ? device.label : value}
      onClick={() => btn.current && openFontPicker(btn.current, value, onChange, DEVICE)}
    >
      <span style={{ fontFamily: fontStack(value) }}>{device ? device.label : value}</span>
      <span aria-hidden="true" className="vx-font-caret">▾</span>
    </button>
  );
}
