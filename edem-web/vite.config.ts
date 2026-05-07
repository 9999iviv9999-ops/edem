import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Сборка staging за nginx: https://edem.press/stg/ (VITE_BASE_PATH=/stg/) */
const rawBase = (process.env.VITE_BASE_PATH || "/").trim() || "/";
const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
