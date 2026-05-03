import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Inlines logo into index.html so it shows even if an old JS bundle is cached or the wrong Vercel root is built. */
function genesoLogoIndexHtml(): import("vite").PluginOption {
  return {
    name: "geneso-inline-logo",
    transformIndexHtml(html) {
      const logoPath = path.join(__dirname, "public", "geneso-logo.png");
      const buf = fs.readFileSync(logoPath);
      const mime =
        buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8
          ? "image/jpeg"
          : "image/png";
      const uri = `data:${mime};base64,${buf.toString("base64")}`;
      const bar = `<a href="/" class="nft-header__brandbar nft-header__brandbar--static" aria-label="Geneso"><img class="nft-header__brandbar-img" src="${uri}" alt="" width="1920" height="480" decoding="async" draggable="false" /></a>`;
      return html.replace("<div id=\"root\"></div>", `${bar}\n    <div id="root"></div>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), genesoLogoIndexHtml()],
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
