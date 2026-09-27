import { useEffect, useRef } from "react";
// @ts-expect-error — plain JS module, no type declarations
import { SpectraOverlayEditor } from "./spectra-overlay-editor.js";
import "./spectra-overlay-editor.css";

export function OverlayEditor({ file }: { file: File | null }) {
  const host = useRef<HTMLDivElement | null>(null);
  const editor = useRef<any>(null);

  useEffect(() => {
    if (host.current) {
      editor.current = new SpectraOverlayEditor(host.current);
    }
    return () => {
      editor.current?.destroy?.();
      editor.current = null;
    };
  }, []);

  useEffect(() => {
    if (file && editor.current) {
      editor.current.setImage(file).catch(() => {
        // The editor already surfaces its own error via its status bar.
      });
    }
  }, [file]);

  return <div ref={host} />;
}
