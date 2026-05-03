import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { marketplaceAbi } from "../web3/abis/marketplaceAbi";
import { useI18n } from "../i18n";
import { HAS_MARKETPLACE, MARKETPLACE_ADDRESS } from "../web3/addresses";
import { useHighestBids, useListings } from "../web3/hooks";
import { formatUserError } from "../web3/errors";
import { formatEth, shortAddress } from "../web3/utils";

export function BidsPage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const { listings, isLoading: isListingsLoading } = useListings();
  const { bids, isLoading: isBidsLoading } = useHighestBids(listings.map((item) => item.id));
  const { writeContractAsync } = useWriteContract();
  const [submittingId, setSubmittingId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onAcceptBid(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    try {
      setError(null);
      setSubmittingId(listingId);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "acceptBid",
        args: [listingId],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.acceptBid"), t));
    } finally {
      setSubmittingId(null);
    }
  }

  async function onCancelBid(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    try {
      setError(null);
      setSubmittingId(listingId);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "cancelBid",
        args: [listingId],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.cancelBid"), t));
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <>
      <header className="nft-page-head">
        <h1 className="nft-page-title">{t("bids.title")}</h1>
        <p className="nft-page-lede">{t("bids.lede")}</p>
      </header>

      {!HAS_MARKETPLACE && (
        <p className="error">{t("errors.missingMarketplace")}</p>
      )}
      {error && <p className="error">{error}</p>}

      {(isListingsLoading || isBidsLoading) && <p className="nft-muted">{t("bids.loading")}</p>}
      {!isListingsLoading && !isBidsLoading && bids.length === 0 && HAS_MARKETPLACE && (
        <p className="nft-muted">{t("bids.noOffers")}</p>
      )}

      <div className="list">
        {bids.map((bid) => {
          const listing = listings.find((item) => item.id === bid.listingId);
          const canAccept = Boolean(
            address && listing && listing.seller.toLowerCase() === address.toLowerCase()
          );

          return (
            <article key={bid.listingId.toString()} className="nft-panel">
              <h2 className="page-title page-title--sm">
                {t("bids.listingHeading", { id: bid.listingId.toString() })}
              </h2>
              <p className="page-sub">
                <strong>{formatEth(bid.amount)} ETH</strong>{" "}
                {t("bids.offerFrom", { addr: shortAddress(bid.bidder) })}
              </p>
              <p className="page-sub">
                {t("bids.seller")}: {listing ? shortAddress(listing.seller) : "—"}
              </p>
              <p className="page-sub">
                {t("bids.status")}: {bid.active ? t("bids.active") : t("bids.inactive")}
              </p>
              <div className="nft-row-actions">
                <button
                  type="button"
                  className="nft-btn nft-btn--primary"
                  onClick={() => onAcceptBid(bid.listingId)}
                  disabled={!canAccept || submittingId === bid.listingId}
                >
                  {t("bids.acceptOffer")}
                </button>
                <button
                  type="button"
                  className="nft-btn nft-btn--outline"
                  onClick={() => onCancelBid(bid.listingId)}
                  disabled={submittingId === bid.listingId}
                >
                  {t("bids.withdrawOffer")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
