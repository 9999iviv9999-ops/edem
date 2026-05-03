/**
 * Geneso NFT web — Ethereum mainnet only (chain id 1).
 * Contract addresses in VITE_* must be deployed on this network.
 */
import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";

export const APP_NAME = "Geneso NFT";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const appUrl =
  typeof window !== "undefined" ? window.location.origin : "https://geneso.xyz";

const connectors = [
  // `injected` works as soon as `window.ethereum` exists; `metaMask()` can stay
  // not "ready" until EIP-6963 announces the extension, which disabled our button.
  injected(),
  metaMask(),
  coinbaseWallet({ appName: APP_NAME }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
          metadata: {
            name: APP_NAME,
            description: "Curated esoteric NFT marketplace",
            url: appUrl,
            icons: [`${appUrl}/favicon.svg`],
          },
        }),
      ]
    : []),
];

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
