import { useQuery } from "@tanstack/react-query";
import { FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { parseEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc721Abi } from "../web3/abis/erc721Abi";
import { marketplaceAbi } from "../web3/abis/marketplaceAbi";
import { useI18n } from "../i18n";
import { HAS_MARKETPLACE, MARKETPLACE_ADDRESS } from "../web3/addresses";
import { DEFAULT_CHAIN } from "../web3/config";
import {
  fetchNftMetadata,
  metadataFromDataUri,
  resolveUri,
  type NftJsonMetadata,
} from "../web3/nftMetadata";
import { formatUserError } from "../web3/errors";
import { formatEth, shortAddress } from "../web3/utils";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

type ListingTuple = readonly [
  `0x${string}`,
  `0x${string}`,
  bigint,
  `0x${string}`,
  bigint,
  boolean,
];
type BidTuple = readonly [`0x${string}`, bigint, bigint, boolean];

export function ItemPage() {
  const { t, locale } = useI18n();
  const { listingId: listingIdParam } = useParams();
  const listingId = useMemo(() => {
    try {
      return listingIdParam ? BigInt(listingIdParam) : null;
    } catch {
      return null;
    }
  }, [listingIdParam]);

  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [bidEth, setBidEth] = useState("0.01");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listingQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getListing",
    args: listingId !== null ? [listingId] : undefined,
    query: { enabled: HAS_MARKETPLACE && listingId !== null && listingId > 0n },
  });

  const bidQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getHighestBid",
    args: listingId !== null ? [listingId] : undefined,
    query: { enabled: HAS_MARKETPLACE && listingId !== null && listingId > 0n },
  });

  const listing = listingQuery.data as unknown as ListingTuple | undefined;
  const bid = bidQuery.data as unknown as BidTuple | undefined;

  const [seller, nft, tokenId, , price, active] = listing ?? [
    "0x0" as const,
    "0x0" as const,
    0n,
    "0x0" as const,
    0n,
    false,
  ];
  const [bidder, bidAmount, bidExpires, bidActive] = bid ?? [
    "0x0" as const,
    0n,
    0n,
    false,
  ];

  const canReadNftMeta = Boolean(
    HAS_MARKETPLACE &&
      listing &&
      active &&
      nft &&
      nft !== ZERO &&
      listingQuery.isSuccess
  );

  const tokenUriQuery = useReadContract({
    address: nft,
    abi: erc721Abi,
    functionName: "tokenURI",
    args: [tokenId],
    query: { enabled: canReadNftMeta },
  });

  const tokenUri = tokenUriQuery.data as string | undefined;
  const inlineMeta = useMemo(
    () => (tokenUri ? metadataFromDataUri(tokenUri) : null),
    [tokenUri]
  );

  const metadataQuery = useQuery({
    queryKey: ["nft-metadata", nft, tokenId, tokenUri],
    queryFn: () => fetchNftMetadata(tokenUri!),
    enabled: Boolean(canReadNftMeta && tokenUri && !inlineMeta && tokenUriQuery.isSuccess),
    staleTime: 60_000,
  });

  const metadata: NftJsonMetadata | undefined = inlineMeta ?? metadataQuery.data;
  const metaImageUrl = metadata?.image ? resolveUri(metadata.image) : undefined;
  const displayTitle = metadata?.name?.trim() || `Token #${tokenId.toString()}`;

  const isOwner = Boolean(address && seller && address.toLowerCase() === seller.toLowerCase());

  async function onBuy() {
    if (!MARKETPLACE_ADDRESS || listingId === null) return;
    try {
      setError(null);
      setSubmitting(true);
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
      setSubmitting(false);
    }
  }

  async function onPlaceBid(e: FormEvent) {
    e.preventDefault();
    if (!MARKETPLACE_ADDRESS || listingId === null) return;
    try {
      setError(null);
      setSubmitting(true);
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
      setSubmitting(false);
    }
  }

  async function onCancelListing() {
    if (!MARKETPLACE_ADDRESS || listingId === null) return;
    try {
      setError(null);
      setSubmitting(true);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "cancelListing",
        args: [listingId],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.withdrawListing"), t));
    } finally {
      setSubmitting(false);
    }
  }

  async function onAcceptBid() {
    if (!MARKETPLACE_ADDRESS || listingId === null) return;
    try {
      setError(null);
      setSubmitting(true);
      await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: marketplaceAbi,
        functionName: "acceptBid",
        args: [listingId],
      });
    } catch (err) {
      setError(formatUserError(err, t("errors.acceptBid"), t));
    } finally {
      setSubmitting(false);
    }
  }

  if (!HAS_MARKETPLACE) {
    return (
      <p className="error">{t("errors.missingMarketplace")}</p>
    );
  }

  if (listingId === null || listingId <= 0n) {
    return (
      <>
        <p className="nft-muted">{t("item.invalidId")}</p>
        <Link to="/" className="nft-link">
          {t("item.backDiscover")}
        </Link>
      </>
    );
  }

  if (listingQuery.isLoading) {
    return <p className="nft-muted">{t("item.loading")}</p>;
  }

  if (!listing || !active) {
    return (
      <>
        <p className="nft-muted">{t("item.notActive")}</p>
        <Link to="/" className="nft-link">
          {t("item.backDiscover")}
        </Link>
      </>
    );
  }

  return (
    <>
      <nav className="nft-breadcrumb">
        <Link to="/" className="nft-link">
          {t("item.breadcrumbDiscover")}
        </Link>
        <span className="nft-breadcrumb__sep">/</span>
        <span>{t("item.breadcrumbListing", { id: listingId.toString() })}</span>
      </nav>

      <div className="nft-item-layout">
        <div className="nft-item-media">
          <span className="nft-listing-card__badge">{DEFAULT_CHAIN.name}</span>
          {metaImageUrl ? (
            <img
              className="nft-item-media__img"
              src={metaImageUrl}
              alt=""
              loading="lazy"
            />
          ) : (
            <span className="nft-item-media__placeholder">#{tokenId.toString()}</span>
          )}
        </div>

        <div className="nft-item-detail">
          <h1 className="nft-page-title">{displayTitle}</h1>
          <p className="nft-page-lede">
            Curated listing on Geneso · Contract {shortAddress(nft)} · Seller {shortAddress(seller)}
          </p>

          {metadata?.description?.trim() ? (
            <p className="nft-item-meta-desc">{metadata.description.trim()}</p>
          ) : null}

          {metadata?.attributes && metadata.attributes.length > 0 ? (
            <ul className="nft-item-traits">
              {metadata.attributes.map((attr, i) => (
                <li key={`${attr.trait_type ?? i}-${i}`} className="nft-item-trait">
                  <span className="nft-item-trait__label">{attr.trait_type ?? t("item.trait")}</span>
                  <span className="nft-item-trait__value">{String(attr.value ?? "—")}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {(tokenUriQuery.isError || metadataQuery.isError) && (
            <p className="page-sub nft-item-meta-fallback">
              Could not load full metadata (check token URI or gateway).
            </p>
          )}

          <div className="nft-item-price-block">
            <span className="nft-price-label">{t("market.listingPrice")}</span>
            <span className="nft-item-price-block__value">{formatEth(price)} ETH</span>
          </div>

          {bidActive && (
            <div className="nft-panel nft-panel--tight">
              <h2 className="nft-panel-title">{t("item.leadingOffer")}</h2>
              <p className="page-sub">
                <strong>{formatEth(bidAmount)} ETH</strong> {t("bids.offerFrom", { addr: shortAddress(bidder) })}
              </p>
              <p className="page-sub">
                {t("item.expires", {
                  date: new Date(Number(bidExpires) * 1000).toLocaleString(
                    locale === "ru" ? "ru-RU" : "en-US"
                  ),
                })}
              </p>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="nft-item-actions">
            <button
              type="button"
              className="nft-btn nft-btn--primary nft-item-actions__full"
              onClick={onBuy}
              disabled={submitting || isOwner}
            >
              {t("market.collectNow")}
            </button>
            <form className="nft-bid-form nft-item-actions__full" onSubmit={onPlaceBid}>
              <input
                value={bidEth}
                onChange={(e) => setBidEth(e.target.value)}
                placeholder={t("market.offerEth")}
                inputMode="decimal"
              />
              <button type="submit" className="nft-btn nft-btn--outline" disabled={submitting}>
                {t("market.placeOffer")}
              </button>
            </form>
            {isOwner && (
              <div className="nft-row-actions nft-item-actions__full">
                <button
                  type="button"
                  className="nft-btn nft-btn--ghost"
                  disabled={submitting}
                  onClick={onCancelListing}
                >
                  {t("market.withdrawListing")}
                </button>
                {bidActive && (
                  <button
                    type="button"
                    className="nft-btn nft-btn--primary"
                    disabled={submitting}
                    onClick={onAcceptBid}
                  >
                    {t("bids.acceptOffer")}
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
