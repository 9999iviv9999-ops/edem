/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKETPLACE_ADDRESS?: string;
  readonly VITE_NFT_COLLECTION_ADDRESS?: string;
  /** https://cloud.walletconnect.com — optional; enables WalletConnect QR */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Default UI language before the user picks one: `ru` or `en` (localStorage still wins). */
  readonly VITE_DEFAULT_LOCALE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
