/**
 * Opens the current dapp in MetaMask mobile in-app browser.
 * Use link.metamask.io (official); metamask.app.link often shows MetaMask’s own 404.
 * @see https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/
 */
export function metamaskDappDeepLink(pageHref: string): string {
  const u = new URL(pageHref);
  const withoutHash = `${u.origin}${u.pathname}${u.search}`;
  return `https://link.metamask.io/dapp/${encodeURIComponent(withoutHash)}`;
}
