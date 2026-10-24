// Saisie au clavier d'une valeur réglée aussi par un curseur.
// Le texte tapé reste libre pendant la frappe (« - », champ vide…) ; la valeur
// n'est transmise que si c'est un nombre, et elle est ramenée dans [min, max]
// quand on quitte le champ ou qu'on appuie sur Entrée.
import { useEffect, useState } from "react";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string; // nom lu par les lecteurs d'écran
};

export function NumberInput({ value, onChange, min, max, step = 1, unit, label }: Props) {
  const [text, setText] = useState(String(value));
  // Le curseur a bougé : le champ suit
  useEffect(() => { setText(String(value)); }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  function commit() {
    const n = Number(text.replace(",", "."));
    const v = text.trim() === "" || !Number.isFinite(n) ? value : clamp(n);
    setText(String(v));
    if (v !== value) onChange(v);
  }

  return (
    <span className="num-input">
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
      />
      {unit && <span className="num-input__unit">{unit}</span>}
    </span>
  );
}
