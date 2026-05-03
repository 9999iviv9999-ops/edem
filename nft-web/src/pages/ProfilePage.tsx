import { useEffect, useMemo, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { TxStatusBanner } from "../components/TxStatusBanner";
import { useI18n } from "../i18n";
import { HAS_MARKETPLACE, MARKETPLACE_ADDRESS } from "../web3/addresses";
import { marketplaceAbi } from "../web3/abis/marketplaceAbi";
import {
  ActivityItem,
  useHighestBids,
  useMarketplaceActivity,
  useMyLeadingBids,
  useMyStats,
  useSellerActiveListings,
} from "../web3/hooks";
import { formatUserError } from "../web3/errors";
import { formatEth, shortAddress } from "../web3/utils";

export function ProfilePage() {
  const { t } = useI18n();
  const { address, isConnected } = useAccount();

  function activityLabel(kind: ActivityItem["kind"]) {
    if (kind === "listing_created") return t("activity.listed");
    if (kind === "listing_bought") return t("activity.sold");
    if (kind === "bid_placed") return t("activity.offerPlaced");
    if (kind === "bid_accepted") return t("activity.offerAccepted");
    return t("activity.listingCancelled");
  }
  const { activeListings, activeBids, purchases, isLoading } = useMyStats();
  const { listings: myListings, isLoading: isMyListingsLoading } = useSellerActiveListings(address);
  const myListingIds = useMemo(() => myListings.map((l) => l.id), [myListings]);
  const { bids: bidsOnMyListings } = useHighestBids(myListingIds);
  const { bids: myBids, isLoading: isMyBidsLoading } = useMyLeadingBids(address);

  const { items: myActivity, isLoading: isMyActivityLoading } = useMarketplaceActivity(address);
  const { items: liveActivity, isLoading: isLiveActivityLoading } = useMarketplaceActivity();

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingListingId, setPendingListingId] = useState<bigint | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!addressCopied) return;
    const id = window.setTimeout(() => setAddressCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [addressCopied]);

  async function copyWalletAddress() {
    if (!address) return;
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(address);
      setAddressCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  function bidForListing(listingId: bigint) {
    return bidsOnMyListings.find((b) => b.listingId === listingId && b.active);
  }

  async function trackTx(promise: Promise<`0x${string}` | undefined>) {
    setActionError(null);
    try {
      const hash = await promise;
      if (hash) setTxHash(hash);
    } catch (err) {
      setActionError(formatUserError(err, t("errors.txFailed"), t));
    } finally {
      setPendingListingId(null);
    }
  }

  async function onCancelListing(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    setPendingListingId(listingId);
    await trackTx(
      writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "cancelListing",
        args: [listingId],
      })
    );
  }

  async function onAcceptBid(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    setPendingListingId(listingId);
    await trackTx(
      writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "acceptBid",
        args: [listingId],
      })
    );
  }

  async function onCancelBid(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    setPendingListingId(listingId);
    await trackTx(
      writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "cancelBid",
        args: [listingId],
      })
    );
  }

  return (
    <>
      <header className="nft-page-head">
        <h1 className="nft-page-title">{t("profile.title")}</h1>
        <p className="nft-page-lede">{t("profile.lede")}</p>
      </header>

      {!HAS_MARKETPLACE && (
        <p className="error">{t("errors.missingMarketplace")}</p>
      )}
      {actionError && <p className="error">{actionError}</p>}
      <TxStatusBanner hash={txHash} onDismiss={() => setTxHash(null)} />

      <div className="grid">
        <article className="nft-panel">
          <h2 className="nft-panel-title">{t("profile.wallet")}</h2>
          <p className="page-sub">
            {t("profile.status")}:{" "}
            <strong>{isConnected ? t("profile.connected") : t("profile.notConnected")}</strong>
          </p>
          <div className="nft-profile-address">
            <p className="nft-mono nft-profile-address__value">{address ?? "—"}</p>
            {address ? (
              <button
                type="button"
                className="nft-btn nft-btn--ghost nft-btn--compact"
                onClick={() => void copyWalletAddress()}
              >
                {addressCopied ? t("profile.addressCopied") : t("profile.copyAddress")}
              </button>
            ) : null}
          </div>
          {copyFailed ? (
            <p className="page-sub nft-inline-error" role="status">
              {t("errors.copyFailed")}
            </p>
          ) : null}
        </article>

        <article className="nft-panel">
          <h2 className="nft-panel-title">{t("profile.stats")}</h2>
          {isLoading && <p className="page-sub">{t("profile.loading")}</p>}
          <p className="page-sub">
            {t("profile.activeListings")}: {activeListings.toString()}
          </p>
          <p className="page-sub">
            {t("profile.activeOffers")}: {activeBids.toString()}
          </p>
          <p className="page-sub">
            {t("profile.purchases")}: {purchases.toString()}
          </p>
        </article>
      </div>

      <div className="profile-section">
        <h2 className="profile-section-title">{t("profile.yourListings")}</h2>
        {isMyListingsLoading && <p className="page-sub">{t("profile.loading")}</p>}
        {!isMyListingsLoading && myListings.length === 0 && HAS_MARKETPLACE && (
          <p className="page-sub">{t("profile.noListings")}</p>
        )}
        <div className="list">
          {myListings.map((item) => {
            const bid = bidForListing(item.id);
            const busy = pendingListingId === item.id;
            return (
              <article key={item.id.toString()} className="nft-panel">
                <h3 className="page-title page-title--sm">
                  {t("profile.listingToken", {
                    id: item.id.toString(),
                    tokenId: item.tokenId.toString(),
                  })}
                </h3>
                <p className="page-sub">{formatEth(item.price)} ETH</p>
                {bid && (
                  <p className="page-sub">
                    {t("profile.topOffer", {
                      amount: formatEth(bid.amount),
                      addr: shortAddress(bid.bidder),
                    })}
                  </p>
                )}
                <div className="nft-row-actions">
                  <button
                    type="button"
                    className="nft-btn nft-btn--ghost"
                    disabled={busy}
                    onClick={() => onCancelListing(item.id)}
                  >
                    {t("market.withdrawListing")}
                  </button>
                  {bid && (
                    <button
                      type="button"
                      className="nft-btn nft-btn--primary"
                      disabled={busy}
                      onClick={() => onAcceptBid(item.id)}
                    >
                      {t("bids.acceptOffer")}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="profile-section">
        <h2 className="profile-section-title">{t("profile.yourOffers")}</h2>
        {isMyBidsLoading && <p className="page-sub">{t("profile.loading")}</p>}
        {!isMyBidsLoading && myBids.length === 0 && HAS_MARKETPLACE && (
          <p className="page-sub">{t("profile.noOffers")}</p>
        )}
        <div className="list">
          {myBids.map((bid) => {
            const busy = pendingListingId === bid.listingId;
            return (
              <article key={bid.listingId.toString()} className="nft-panel">
                <h3 className="page-title page-title--sm">Listing #{bid.listingId.toString()}</h3>
                <p className="page-sub">{formatEth(bid.amount)} ETH</p>
                <button
                  type="button"
                  className="nft-btn nft-btn--outline"
                  disabled={busy}
                  onClick={() => onCancelBid(bid.listingId)}
                >
                  Withdraw offer
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid profile-section">
        <article className="nft-panel">
          <h2 className="nft-panel-title">{t("profile.yourActivity")}</h2>
          {isMyActivityLoading && <p className="page-sub">{t("profile.loading")}</p>}
          {!isMyActivityLoading && myActivity.length === 0 && (
            <p className="page-sub">{t("profile.noActivity")}</p>
          )}
          {myActivity.map((item) => (
            <p key={item.id} className="page-sub">
              {t("activity.line", {
                id: item.listingId.toString(),
                kind: activityLabel(item.kind),
                amount:
                  typeof item.amount === "bigint" ? ` · ${formatEth(item.amount)} ETH` : "",
              })}
            </p>
          ))}
        </article>

        <article className="nft-panel">
          <h2 className="nft-panel-title">{t("profile.globalActivity")}</h2>
          {isLiveActivityLoading && <p className="page-sub">{t("profile.loading")}</p>}
          {!isLiveActivityLoading && liveActivity.length === 0 && (
            <p className="page-sub">{t("profile.noGlobalActivity")}</p>
          )}
          {liveActivity.map((item) => (
            <p key={item.id} className="page-sub">
              {t("activity.line", {
                id: item.listingId.toString(),
                kind: activityLabel(item.kind),
                amount:
                  typeof item.amount === "bigint" ? ` · ${formatEth(item.amount)} ETH` : "",
              })}
            </p>
          ))}
        </article>
      </div>
    </>
  );
}
