import { useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc721Abi } from "../web3/abis/erc721Abi";
import { marketplaceAbi } from "../web3/abis/marketplaceAbi";
import { useI18n } from "../i18n";
import {
  HAS_MARKETPLACE,
  MARKETPLACE_ADDRESS,
  NFT_COLLECTION_ADDRESS,
} from "../web3/addresses";
import { useListings, useMarketplaceStats } from "../web3/hooks";
import { DEFAULT_CHAIN } from "../web3/config";
import {
  fetchNftMetadata,
  metadataFromDataUri,
  resolveUri,
  type NftJsonMetadata,
} from "../web3/nftMetadata";
import { formatUserError } from "../web3/errors";
import { formatEth, shortAddress } from "../web3/utils";

export function MarketplacePage() {
  const { t } = useI18n();
  const { address } = useAccount();
  const { listings, isLoading } = useListings();
  const { platformFeeBps } = useMarketplaceStats();
  const { writeContractAsync } = useWriteContract();
  const [bidEth, setBidEth] = useState("0.01");
  const [tokenIdToList, setTokenIdToList] = useState("");
  const [listingPriceEth, setListingPriceEth] = useState("0.02");
  const [submittingId, setSubmittingId] = useState<bigint | null>(null);
  const [isListing, setIsListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBuy(listingId: bigint, price: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    try {
      setError(null);
      setSubmittingId(listingId);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "buy",
        args: [listingId],
        value: price,
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.buy"), t));
    } finally {
      setSubmittingId(null);
    }
  }

  async function onPlaceBid(listingId: bigint, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!MARKETPLACE_ADDRESS) return;
    try {
      setError(null);
      setSubmittingId(listingId);
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 24 * 60 * 60);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "placeBid",
        args: [listingId, expiresAt],
        value: parseEther(bidEth || "0"),
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.bid"), t));
    } finally {
      setSubmittingId(null);
    }
  }

  async function onCancelListing(listingId: bigint) {
    if (!MARKETPLACE_ADDRESS) return;
    try {
      setError(null);
      setSubmittingId(listingId);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "cancelListing",
        args: [listingId],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.withdrawListing"), t));
    } finally {
      setSubmittingId(null);
    }
  }

  async function onCreateListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!MARKETPLACE_ADDRESS || !NFT_COLLECTION_ADDRESS) return;
    try {
      setError(null);
      setIsListing(true);
      const tokenId = BigInt(tokenIdToList);
      const price = parseEther(listingPriceEth || "0");

      await writeContractAsync({
        address: NFT_COLLECTION_ADDRESS,
        abi: erc721Abi,
        functionName: "approve",
        args: [MARKETPLACE_ADDRESS, tokenId],
      });

      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "createListing",
        args: [NFT_COLLECTION_ADDRESS, tokenId, price],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.publish"), t));
    } finally {
      setIsListing(false);
    }
  }

  return (
    <>
      <header className="nft-page-head">
        <h1 className="nft-page-title">{t("market.discoverTitle")}</h1>
        <p className="nft-page-lede">{t("market.discoverLede")}</p>
        <div className="nft-stats-row">
          <span className="nft-stat-chip">
            {t("market.network")}: <strong>{DEFAULT_CHAIN.name}</strong>
          </span>
          <span className="nft-stat-chip">
            {t("market.fee")}: <strong>{(platformFeeBps / 100).toFixed(2)}%</strong>
          </span>
          <span className="nft-stat-chip">
            {t("market.listed")}: <strong>{listings.length}</strong>
          </span>
        </div>
      </header>

      <div className="nft-toolbar">
        <label className="nft-search">
          <span className="visually-hidden">{t("market.searchPlaceholder")}</span>
          <input type="search" placeholder={t("market.searchPlaceholder")} disabled />
        </label>
        <span className="nft-toolbar__meta">{t("market.toolbarMeta")}</span>
      </div>

      {!HAS_MARKETPLACE && (
        <p className="error">{t("errors.missingMarketplace")}</p>
      )}
      {error && <p className="error">{error}</p>}

      <section className="nft-panel">
        <h2 className="nft-panel-title nft-panel-title--lg">{t("market.listTitle")}</h2>
        <p className="page-sub">{t("market.listLede")}</p>
        <form className="row" onSubmit={onCreateListing}>
          <input
            value={tokenIdToList}
            onChange={(e) => setTokenIdToList(e.target.value)}
            placeholder={t("market.tokenId")}
            inputMode="numeric"
            required
          />
          <input
            value={listingPriceEth}
            onChange={(e) => setListingPriceEth(e.target.value)}
            placeholder={t("market.priceEth")}
            inputMode="decimal"
            required
          />
          <button className="nft-btn nft-btn--primary" type="submit" disabled={isListing}>
            {isListing ? t("market.publishing") : t("market.authorizePublish")}
          </button>
        </form>
      </section>

      {isLoading && <p className="nft-muted">{t("market.loadingListings")}</p>}
      {!isLoading && listings.length === 0 && HAS_MARKETPLACE && (
        <p className="nft-muted">{t("market.noListings")}</p>
      )}

      <div className="nft-grid">
        {listings.map((item) => {
          const isOwner =
            address && item.seller.toLowerCase() === address.toLowerCase();
          return (
            <ListingCard
              key={item.id.toString()}
              item={item}
              isOwner={Boolean(isOwner)}
              bidEth={bidEth}
              submitting={submittingId === item.id}
              onBidEthChange={setBidEth}
              onBuy={onBuy}
              onPlaceBid={onPlaceBid}
              onCancelListing={onCancelListing}
            />
          );
        })}
      </div>
    </>
  );
}

type ListingCardProps = {
  item: Awaited<ReturnType<typeof useListings>>["listings"][number];
  isOwner: boolean;
  bidEth: string;
  submitting: boolean;
  onBidEthChange: (value: string) => void;
  onBuy: (listingId: bigint, price: bigint) => Promise<void>;
  onPlaceBid: (listingId: bigint, event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancelListing: (listingId: bigint) => Promise<void>;
};

function ListingCard({
  item,
  isOwner,
  bidEth,
  submitting,
  onBidEthChange,
  onBuy,
  onPlaceBid,
  onCancelListing,
}: ListingCardProps) {
  const { t } = useI18n();
  const tokenUriQuery = useReadContract({
    address: item.nft,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [item.tokenId],
    query: { enabled: Boolean(item.nft), staleTime: 60_000 },
  });

  const tokenUri = tokenUriQuery.data as string | undefined;
  const inlineMeta = useMemo(
    () => (tokenUri ? metadataFromDataUri(tokenUri) : null),
    [tokenUri]
  );

  const metadataQuery = useQuery({
    queryKey: ["listing-nft-metadata", item.nft, item.tokenId, tokenUri],
    queryFn: () => fetchNftMetadata(tokenUri!),
    enabled: Boolean(tokenUri && !inlineMeta && tokenUriQuery.isSuccess),
    staleTime: 60_000,
  });

  const metadata: NftJsonMetadata | undefined = inlineMeta ?? metadataQuery.data;
  const metaImageUrl = metadata?.image ? resolveUri(metadata.image) : undefined;
  const displayTitle = metadata?.name?.trim() || `Token #${item.tokenId.toString()}`;

  return (
    <article className="nft-listing-card">
      <div className="nft-listing-card__media">
        <span className="nft-listing-card__badge">{t("market.badgeErc721")}</span>
        {metaImageUrl ? (
          <img className="nft-listing-card__img" src={metaImageUrl} alt="" loading="lazy" />
        ) : (
          <span className="nft-listing-card__placeholder">#{item.tokenId.toString()}</span>
        )}
      </div>
      <div className="nft-listing-card__body">
        <h3 className="nft-listing-card__name">{displayTitle}</h3>
        <p className="nft-listing-card__collection">
          {t("market.listingLine", { id: item.id.toString(), nft: shortAddress(item.nft) })}
        </p>
        <div className="nft-price-row">
          <span className="nft-price-label">{t("market.listingPrice")}</span>
          <span className="nft-price-value">{formatEth(item.price)} ETH</span>
        </div>
        <p className="nft-listing-card__seller">
          {t("market.from", {
            addr: shortAddress(item.seller),
            you: isOwner ? t("market.youListed") : "",
          })}
        </p>
        <div className="nft-listing-card__actions">
          <Link to={`/item/${item.id.toString()}`} className="nft-btn nft-btn--ghost nft-listing-card__link">
            {t("market.viewListing")}
          </Link>
          <button
            type="button"
            className="nft-btn nft-btn--primary"
            onClick={() => onBuy(item.id, item.price)}
            disabled={submitting || isOwner}
          >
            {t("market.collectNow")}
          </button>
          <form className="nft-bid-form" onSubmit={(e) => onPlaceBid(item.id, e)}>
            <input
              value={bidEth}
              onChange={(e) => onBidEthChange(e.target.value)}
              placeholder={t("market.offerEth")}
              inputMode="decimal"
            />
            <button type="submit" className="nft-btn nft-btn--outline" disabled={submitting}>
              {t("market.placeOffer")}
            </button>
          </form>
          {isOwner && (
            <button
              type="button"
              className="nft-btn nft-btn--ghost"
              onClick={() => onCancelListing(item.id)}
              disabled={submitting}
            >
              {t("market.withdrawListing")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
