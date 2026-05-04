import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Copy canonical logo to public/ for static /guides/ pages (same file as in src/assets). */
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

      // Mirror Russian guides from repository docs into public/guides for live site links.
      const guidePairs: Array<[string, string]> = [
        [
          path.join(__dirname, "..", "docs", "geneso", "guides", "SELLER_GUIDE_RU.md"),
          path.join(__dirname, "public", "guides", "SELLER_GUIDE_RU.md"),
        ],
        [
          path.join(__dirname, "..", "docs", "geneso", "guides", "BUYER_GUIDE_RU.md"),
          path.join(__dirname, "public", "guides", "BUYER_GUIDE_RU.md"),
        ],
        [
          path.join(__dirname, "..", "docs", "geneso", "guides", "ADDRESSES.md"),
          path.join(__dirname, "public", "guides", "ADDRESSES.md"),
        ],
      ];

      for (const [guideSrc, guideDest] of guidePairs) {
        if (!fs.existsSync(guideSrc)) continue;
        fs.mkdirSync(path.dirname(guideDest), { recursive: true });
        fs.copyFileSync(guideSrc, guideDest);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), syncGenesoLogoToPublic()],
  build: {
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
