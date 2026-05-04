export const en = {
  "nav.discover": "Discover",
  "nav.offers": "Offers",
  "nav.profile": "Profile",
  "nav.primary": "Primary navigation",

  "brand.tagline": "Curated Esoteric NFTs",
  "brand.logoAlt": "Geneso — home, esoteric NFT marketplace",

  "header.networkTitle": "Connected network",
  "footer.text":
    "Geneso · Curated esoteric NFTs · Verified creators · On-chain ownership",
  "footer.legalNav": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.cookies": "Cookies",
  "footer.guides": "Guides",

  "lang.en": "EN",
  "lang.ru": "RU",
  "lang.switch": "Language",

  "wallet.connect": "Connect your wallet",
  "wallet.connecting": "Connecting…",
  "wallet.stuckHint":
    " — Open MetaMask and approve or reject the waiting request. If it is stuck: MetaMask → ⋮ → Connected sites → disconnect this site, then connect again on {{chain}}.",
  "wallet.mobileWalletConnectRequired":
    "Tip: in mobile Safari/Chrome there is often no browser extension. Prefer “WalletConnect” below if available, open this site inside MetaMask’s browser, or ask the admin to set VITE_WALLETCONNECT_PROJECT_ID for reliable mobile linking.",

  "market.discoverTitle": "Discover",
  "market.discoverLede":
    "Discover and collect esoteric NFTs with meaning. Geneso curates tarot, astrology, runes, sacred geometry, and spiritual digital art for creators and collectors.",
  "market.network": "Network",
  "market.fee": "Fee",
  "market.listed": "Listed",
  "market.searchPlaceholder": "Search by category, trait, or creator (coming soon)",
  "market.toolbarMeta": "On-chain listings · Curated esoteric marketplace",
  "market.listTitle": "List your work",
  "market.listLede":
    "Authorize Geneso once for your token, then set a fixed price in ETH. Same on-chain flow as major marketplaces, in a calmer context.",
  "market.tokenId": "Token ID",
  "market.priceEth": "Price in ETH",
  "market.authorizePublish": "Authorize & publish",
  "market.publishing": "Publishing…",
  "market.loadingListings": "Loading listings…",
  "market.noListings": "No listings yet. Offer the first piece to the circle.",
  "market.listingPrice": "Listing price",
  "market.listingLine": "Listing #{{id}} · {{nft}}",
  "market.from": "From {{addr}}{{you}}",
  "market.youListed": " · You listed this",
  "market.viewListing": "View listing",
  "market.collectNow": "Collect now",
  "market.offerEth": "Offer (ETH)",
  "market.placeOffer": "Place offer",
  "market.withdrawListing": "Withdraw listing",
  "market.badgeErc721": "ERC-721",

  "bids.title": "Offers",
  "bids.lede":
    "Review active offers across curated esoteric collections. Sellers can accept meaningful bids, and bidders can cancel before acceptance.",
  "bids.loading": "Loading offers…",
  "bids.noOffers": "No active offers right now.",
  "bids.listingHeading": "Listing #{{id}}",
  "bids.amountFrom": "{{amount}} ETH from {{addr}}",
  "bids.offerFrom": "from {{addr}}",
  "bids.seller": "Seller",
  "bids.status": "Status",
  "bids.active": "Active",
  "bids.inactive": "Inactive",
  "bids.acceptOffer": "Accept offer",
  "bids.withdrawOffer": "Withdraw offer",

  "profile.title": "Profile",
  "profile.lede":
    "Track your creator and collector journey: wallet status, your listings, your offers, and recent on-chain activity inside the Geneso ecosystem.",
  "profile.wallet": "Wallet",
  "profile.status": "Status",
  "profile.connected": "Connected",
  "profile.notConnected": "Not connected",
  "profile.stats": "Stats",
  "profile.loading": "Loading…",
  "profile.activeListings": "Active listings",
  "profile.activeOffers": "Active offers",
  "profile.purchases": "Purchases",
  "profile.yourListings": "Your listings",
  "profile.noListings": "No active listings.",
  "profile.yourOffers": "Your offers",
  "profile.noOffers": "No active offers.",
  "profile.listingToken": "Listing #{{id}} · #{{tokenId}}",
  "profile.topOffer": "Top offer: {{amount}} ETH · {{addr}}",
  "profile.yourActivity": "Your activity",
  "profile.noActivity": "No recent events for this wallet.",
  "profile.globalActivity": "Global activity",
  "profile.noGlobalActivity": "No recent marketplace events.",
  "profile.copyAddress": "Copy address",
  "profile.addressCopied": "Copied",

  "activity.listed": "Listed",
  "activity.sold": "Sold",
  "activity.offerPlaced": "Offer placed",
  "activity.offerAccepted": "Offer accepted",
  "activity.listingCancelled": "Listing cancelled",
  "activity.line": "#{{id}} · {{kind}}{{amount}}",

  "item.invalidId": "Invalid listing ID.",
  "item.backDiscover": "← Back to Discover",
  "item.loading": "Loading listing…",
  "item.notActive": "This listing is not active or does not exist.",
  "item.breadcrumbDiscover": "Discover",
  "item.breadcrumbListing": "Listing #{{id}}",
  "item.lede":
    "Curated listing on Geneso · Contract {{nft}} · Seller {{seller}}",
  "item.metadataError": "Could not load full metadata (check token URI or gateway).",
  "item.trait": "Trait",
  "item.leadingOffer": "Leading offer",
  "item.expires": "Expires {{date}}",

  "tx.transaction": "Transaction",
  "tx.waiting": "Waiting for confirmation…",
  "tx.confirmed": "Confirmed in block {{block}}.",
  "tx.revert":
    "The chain recorded a revert. Check listing state, approvals, and network.",
  "tx.close": "Close",

  "errors.missingMarketplace":
    "Set VITE_MARKETPLACE_ADDRESS (and VITE_NFT_COLLECTION_ADDRESS to list) in nft-web/.env for local dev, or in the Vercel project Environment Variables for production, then redeploy.",
  "errors.userRejected":
    "You closed the wallet without confirming. Nothing was changed.",
  "errors.insufficientFunds":
    "This wallet does not have enough ETH for this action (including gas).",
  "errors.wrongNetwork": "Switch your wallet to {{chain}}, then try again.",
  "errors.noncePending":
    "A previous transaction may still be pending. Wait a moment or reset the account in your wallet if needed.",
  "errors.executionReverted":
    "The contract could not complete this. Check approvals, listing state, price, and network.",
  "errors.rpcIssue":
    "Network or RPC issue. Check your connection and try again in a few seconds.",
  "errors.buy": "We could not complete the purchase.",
  "errors.bid": "We could not place this offer.",
  "errors.withdrawListing": "We could not withdraw this listing.",
  "errors.publish": "We could not publish this listing.",
  "errors.acceptBid": "We could not accept this offer.",
  "errors.cancelBid": "We could not withdraw this offer.",
  "errors.txFailed": "This transaction did not go through.",
  "errors.confirmTx": "We could not confirm this transaction on-chain.",
  "errors.copyFailed": "Could not copy to clipboard.",

  "chain.fallback": "Chain {{id}}",

  "meta.windowTitle": "{{page}} · Geneso",

  "errorBoundary.title": "Something went wrong",
  "errorBoundary.body": "Please reload the page. If the problem repeats, try clearing the site cache or updating the browser.",
  "errorBoundary.reload": "Reload page",
} as const;

export type MessageKey = keyof typeof en;
