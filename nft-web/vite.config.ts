import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Copy canonical logo to public/ on every dev/build (guides + /geneso-logo.jpg). */
function syncGenesoLogoToPublic(): Plugin {
  return {
    name: "sync-geneso-logo-to-public",
    buildStart() {
      const src = path.join(__dirname, "src", "assets", "geneso-logo.jpg");
      const dest = path.join(__dirname, "public", "geneso-logo.jpg");
      if (!fs.existsSync(src)) {
        this.error(`Missing logo: ${src}`);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [react(), syncGenesoLogoToPublic()],
  build: {
    /** Inline logo into JS (no separate /assets/*.jpg) so CDN SPA rewrites cannot break it. */
    assetsInlineLimit: 200000,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          web3: ["wagmi", "viem", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
