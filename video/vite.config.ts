import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import type { Plugin } from "vite";

// Bibliothèque de polices : un seul exemplaire dans le dépôt (../frontend/public/fonts).
// Servie telle quelle en développement, copiée dans dist/fonts au build.
const FONTS_DIR = path.resolve(__dirname, "../frontend/public/fonts");
function sharedFonts(): Plugin {
  let outDir = "dist";
  return {
    name: "noxel-shared-fonts",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir); },
    configureServer(server) {
      server.middlewares.use("/fonts", (req, res, next) => {
        const rel = decodeURIComponent((req.url || "/").split("?")[0]);
        const file = path.join(FONTS_DIR, rel);
        if (!file.startsWith(FONTS_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader("Content-Type", file.endsWith(".json") ? "application/json" : "font/woff2");
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (fs.existsSync(FONTS_DIR)) fs.cpSync(FONTS_DIR, path.join(outDir, "fonts"), { recursive: true });
    },
  };
}

// Le kit HUD est partagé avec Spectra image (../frontend) : un seul kit à maintenir.
export default defineConfig({
  plugins: [react(), sharedFonts()],
  resolve: {
    alias: { "@hud": path.resolve(__dirname, "../frontend/src/components/hud") },
    // Une seule copie de React, même pour les fichiers importés depuis ../frontend
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: [".."] } },
});
