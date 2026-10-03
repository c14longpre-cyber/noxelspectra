// NOXEL Spectra — pictogrammes de la sidebar (extraits du kit HUD, sans les anneaux).
// Dessins internes du kit uniquement : jamais de contenu utilisateur.
export const NAV_ICONS: Record<string, string> = {
  "projects": "<path d=\"M5 3h9l5 5v13H5V3Zm9 0v5h5M8 12h8M8 16h6\"/>",
  "analyze": "<circle cx=\"10\" cy=\"10\" r=\"7\"/><path d=\"m15 15 6 6M6 12V9m4 4V6m4 6V8\"/>",
  "convert": "<path d=\"M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4\"/>",
  "batch": "<rect x=\"2\" y=\"2\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"14\" y=\"2\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"2\" y=\"14\" width=\"8\" height=\"8\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"8\" height=\"8\" rx=\"1\"/>",
  "resize": "<path d=\"M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6m0-6 6-6m6 18 6-6\"/>",
  "crop": "<path d=\"M6 2v16h16M2 6h16v16M18 2 2 18\"/>",
  "removebg": "<path d=\"M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5\"/><circle cx=\"12\" cy=\"8\" r=\"3\"/><path d=\"M6 18v-2a6 6 0 0 1 12 0v2\"/>",
  "rotate": "<path d=\"M20 7a9 9 0 1 0 1 9M20 2v5h-5\"/>",
  "adjust": "<path d=\"M2 5h7m5 0h8M2 12h13m5 0h2M2 19h3m5 0h12\"/><circle cx=\"11\" cy=\"5\" r=\"2\"/><circle cx=\"17\" cy=\"12\" r=\"2\"/><circle cx=\"7\" cy=\"19\" r=\"2\"/>",
  "responsive": "<rect x=\"2\" y=\"3\" width=\"15\" height=\"13\" rx=\"1\"/><path d=\"M8 16v4m-3 0h8\"/><rect x=\"16\" y=\"10\" width=\"6\" height=\"12\" rx=\"1\"/>",
  "palette": "<path d=\"M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4l-1-1a2 2 0 0 1 2-3h2a3 3 0 0 0 3-3 9 9 0 0 0-9-7Z\"/><circle cx=\"7\" cy=\"8\" r=\".8\"/><circle cx=\"12\" cy=\"6\" r=\".8\"/><circle cx=\"17\" cy=\"8\" r=\".8\"/><circle cx=\"5\" cy=\"13\" r=\".8\"/>",
  "vectorize": "<path d=\"M3 18C3 4 21 4 21 18M5 18h14M12 5v5\"/><rect x=\"1\" y=\"16\" width=\"4\" height=\"4\"/><rect x=\"19\" y=\"16\" width=\"4\" height=\"4\"/><rect x=\"10\" y=\"3\" width=\"4\" height=\"4\"/>",
  "favicon": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\"/><path d=\"m8 16 4-9 4 9M9 13h6\"/>",
  "metaclean": "<path d=\"M4 3h11l5 5v13H4V3Zm11 0v5h5M8 12h8M8 16h5\"/><path d=\"m15 15 6 6m0-6-6 6\"/>",
  "shadow": "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2\" opacity=\".35\"/><rect x=\"3\" y=\"3\" width=\"13\" height=\"13\" rx=\"2\"/>",
  "glow": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2\"/>",
  "social": "<circle cx=\"5\" cy=\"12\" r=\"3\"/><circle cx=\"19\" cy=\"5\" r=\"3\"/><circle cx=\"19\" cy=\"19\" r=\"3\"/><path d=\"m8 11 8-5m-8 7 8 5\"/>",
  "editor": "<path d=\"m4 15 12-12 5 5L9 20l-6 1 1-6Zm9-9 5 5\"/>",
  "gradient": "<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\"/><path d=\"M7 6v12m5-12v12m5-12v12\" opacity=\".5\"/>",
  "watermark": "<path d=\"M5 21h14M4 16h16l-1-3h-4V6a3 3 0 0 0-6 0v7H5l-1 3Z\"/>",
  "copyright": "<path d=\"M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6l-9-4Z\"/><path d=\"M15 9a4 4 0 1 0 0 6\"/>"
};

export function NavIcon({ id, fallback }: { id: string; fallback: string }) {
  const markup = NAV_ICONS[id];
  if (!markup) return <span aria-hidden="true">{fallback}</span>;
  return (
    <svg
      className="noxel-nav-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
