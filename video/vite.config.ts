import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Le kit HUD est partagé avec Spectra image (../frontend) : un seul kit à maintenir.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@hud": path.resolve(__dirname, "../frontend/src/components/hud") },
    // Une seule copie de React, même pour les fichiers importés depuis ../frontend
    dedupe: ["react", "react-dom"],
  },
  server: { fs: { allow: [".."] } },
});
