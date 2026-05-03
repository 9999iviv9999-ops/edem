import genesoLogo from "./assets/geneso-logo.jpg";

/**
 * With `build.assetsInlineLimit` in vite.config, this becomes a data URL in the main chunk
 * (no extra request). Source: src/assets/geneso-logo.jpg; also copied to public/ for /guides/.
 */
export const GENESO_LOGO_SRC = genesoLogo;
