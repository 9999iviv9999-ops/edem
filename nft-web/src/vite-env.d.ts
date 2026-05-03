/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKETPLACE_ADDRESS?: string;
  readonly VITE_NFT_COLLECTION_ADDRESS?: string;
  /** https://cloud.walletconnect.com — optional; enables WalletConnect QR */
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
