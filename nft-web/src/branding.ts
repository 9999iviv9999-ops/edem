/**
 * Logo at `public/geneso-logo.png` (dist root). BASE_URL supports subpath deploys.
 * Avoid only hashed `/assets/` URLs if the host rewrites unknown paths to `index.html`.
 */
const base = import.meta.env.BASE_URL;
export const GENESO_LOGO_SRC = `${base.endsWith("/") ? base : `${base}/`}geneso-logo.png`;
