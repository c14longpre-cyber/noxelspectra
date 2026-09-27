import { useEffect, useRef } from "react";
// @ts-expect-error — plain JS module, no type declarations
import { SpectraGradientEditor } from "./spectra-gradient.js";
import "./spectra-gradient.css";

export function GradientTool() {
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<any>(null);

  useEffect(() => {
    if (host.current) {
      editor.current = new SpectraGradientEditor(host.current);
    }
    return () => {
      editor.current?.destroy?.();
      editor.current = null;
    };
  }, []);

  return <div ref={host} />;
}
