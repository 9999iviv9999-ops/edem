/**
 * Geneso NFT web — Ethereum mainnet only (chain id 1).
 * Contract addresses in VITE_* must be deployed on this network.
 */
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";

export const APP_NAME = "Geneso NFT";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

/** True when a WalletConnect Cloud project id is set (required for most mobile browsers). */
export const WALLET_CONNECT_CONFIGURED = Boolean(walletConnectProjectId);

const appUrl =
  typeof window !== "undefined" ? window.location.origin : "https://geneso.xyz";

function createConnectors() {
  const injectedConnector = injected();
  const metaMaskConnector = metaMask();
  const coinbaseConnector = coinbaseWallet({ appName: APP_NAME });
  const base = [injectedConnector, metaMaskConnector, coinbaseConnector];

  if (!walletConnectProjectId) {
    return base;
  }

  const wc = walletConnect({
    projectId: walletConnectProjectId,
    showQrModal: true,
    metadata: {
      name: APP_NAME,
      description: "Curated esoteric NFT marketplace",
      url: appUrl,
      icons: [`${appUrl}/favicon.svg`],
    },
  });

  const isBrowser = typeof window !== "undefined";
  const ua = isBrowser ? navigator.userAgent : "";
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const hasInjected =
    isBrowser && Boolean((window as unknown as { ethereum?: unknown }).ethereum);

  // Mobile Safari/Chrome usually have no `window.ethereum`; WalletConnect should be first.
  if (isMobileUa && !hasInjected) {
    return [wc, ...base];
  }

  return [...base, wc];
}

const connectors = createConnectors();

export const SUPPORTED_CHAINS = [mainnet] as const;

export const DEFAULT_CHAIN = mainnet;

export const PLATFORM_FEE_BPS_DEFAULT = 250;
export const PLATFORM_FEE_BPS_MAX = 1000;

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors,
  transports: {
    [mainnet.id]: http(),
  },
  multiInjectedProviderDiscovery: true,
  ssr: false,
});
