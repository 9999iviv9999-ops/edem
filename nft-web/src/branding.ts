/**
 * Logo at site root (`public/geneso-logo.png`, synced from `src/assets` on build).
 * PNG = artwork on transparent backdrop → sits cleanly on solid `--nft-header-logo-strip`.
 * Fallback JPG remains in assets for reference / tooling.
 */
export const GENESO_LOGO_SRC = `${import.meta.env.BASE_URL}geneso-logo.png`;
