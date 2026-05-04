/** Opens the current dapp inside MetaMask mobile (in-app browser). */
export function metamaskDappDeepLink(pageHref: string): string {
  return `https://metamask.app.link/dapp/${encodeURIComponent(pageHref)}`;
}
