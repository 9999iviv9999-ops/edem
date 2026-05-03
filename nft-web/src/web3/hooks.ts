import { useEffect, useMemo, useState } from "react";
import { Address, parseAbiItem } from "viem";
import { useAccount, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { marketplaceAbi } from "./abis/marketplaceAbi";
import { HAS_MARKETPLACE, MARKETPLACE_ADDRESS } from "./addresses";
import { DEFAULT_CHAIN } from "./config";

export type ListingView = {
  id: bigint;
  seller: Address;
  nft: Address;
  tokenId: bigint;
  paymentToken: Address;
  price: bigint;
  active: boolean;
};

export type BidView = {
  listingId: bigint;
  bidder: Address;
  amount: bigint;
  expiresAt: bigint;
  active: boolean;
};

export type ActivityItem = {
  id: string;
  kind: "listing_created" | "listing_bought" | "bid_placed" | "bid_accepted" | "listing_cancelled";
  listingId: bigint;
  actor: Address;
  amount?: bigint;
  blockNumber: bigint;
  txHash: Address | string;
};

type ListingTuple = readonly [Address, Address, bigint, Address, bigint, boolean];
type BidTuple = readonly [Address, bigint, bigint, boolean];
type UserStatsTuple = readonly [bigint, bigint, bigint];

export function useMarketplaceStats() {
  const totalListingsQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "totalListings",
    query: { enabled: HAS_MARKETPLACE, refetchInterval: 6000 },
  });

  const feeQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "platformFeeBps",
    query: { enabled: HAS_MARKETPLACE, refetchInterval: 15000 },
  });

  return {
    totalListings: (totalListingsQuery.data as bigint | undefined) ?? 0n,
    platformFeeBps: (feeQuery.data as number | undefined) ?? 250,
    isLoading: totalListingsQuery.isLoading || feeQuery.isLoading,
  };
}

export function useListings(limit = 20) {
  const { totalListings } = useMarketplaceStats();
  const count = Number(totalListings > BigInt(limit) ? BigInt(limit) : totalListings);
  const listingIds = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count]
  );

  const listingsQuery = useReadContracts({
    contracts: listingIds.map((id) => ({
      address: MARKETPLACE_ADDRESS!,
      abi: marketplaceAbi,
      functionName: "getListing",
      args: [id],
    })),
    query: { enabled: HAS_MARKETPLACE && listingIds.length > 0, refetchInterval: 6000 },
  });

  const listings = useMemo(() => {
    return (listingsQuery.data ?? [])
      .map((entry, idx) => {
        if (entry.status !== "success" || !entry.result) {
          return null;
        }
        const [seller, nft, tokenId, paymentToken, price, active] = entry.result as unknown as ListingTuple;
        return {
          id: listingIds[idx],
          seller,
          nft,
          tokenId,
          paymentToken,
          price,
          active,
        } satisfies ListingView;
      })
      .filter((item): item is ListingView => Boolean(item && item.active));
  }, [listingsQuery.data, listingIds]);

  return {
    listings,
    isLoading: listingsQuery.isLoading,
  };
}

export function useSellerActiveListings(seller: Address | undefined, limit = 40) {
  const { totalListings } = useMarketplaceStats();
  const count = Number(totalListings > BigInt(limit) ? BigInt(limit) : totalListings);
  const listingIds = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count]
  );

  const listingsQuery = useReadContracts({
    contracts: listingIds.map((id) => ({
      address: MARKETPLACE_ADDRESS!,
      abi: marketplaceAbi,
      functionName: "getListing",
      args: [id],
    })),
    query: { enabled: HAS_MARKETPLACE && Boolean(seller) && listingIds.length > 0, refetchInterval: 6000 },
  });

  const listings = useMemo(() => {
    if (!seller) {
      return [];
    }
    const me = seller.toLowerCase();
    return (listingsQuery.data ?? [])
      .map((entry, idx) => {
        if (entry.status !== "success" || !entry.result) {
          return null;
        }
        const [sellerAddr, nft, tokenId, paymentToken, price, active] = entry.result as unknown as ListingTuple;
        return {
          id: listingIds[idx],
          seller: sellerAddr,
          nft,
          tokenId,
          paymentToken,
          price,
          active,
        } satisfies ListingView;
      })
      .filter(
        (item): item is ListingView =>
          Boolean(item && item.active && item.seller.toLowerCase() === me)
      );
  }, [listingsQuery.data, listingIds, seller]);

  return {
    listings,
    isLoading: listingsQuery.isLoading,
  };
}

export function useMyLeadingBids(bidder: Address | undefined, limit = 40) {
  const { totalListings } = useMarketplaceStats();
  const count = Number(totalListings > BigInt(limit) ? BigInt(limit) : totalListings);
  const listingIds = useMemo(
    () => Array.from({ length: count }, (_, i) => BigInt(i + 1)),
    [count]
  );

  const bidsQuery = useReadContracts({
    contracts: listingIds.map((id) => ({
      address: MARKETPLACE_ADDRESS!,
      abi: marketplaceAbi,
      functionName: "getHighestBid",
      args: [id],
    })),
    query: { enabled: HAS_MARKETPLACE && Boolean(bidder) && listingIds.length > 0, refetchInterval: 6000 },
  });

  const bids = useMemo(() => {
    if (!bidder) {
      return [];
    }
    const me = bidder.toLowerCase();
    return (bidsQuery.data ?? [])
      .map((entry, idx) => {
        if (entry.status !== "success" || !entry.result) {
          return null;
        }
        const [bidderAddr, amount, expiresAt, active] = entry.result as unknown as BidTuple;
        return {
          listingId: listingIds[idx],
          bidder: bidderAddr,
          amount,
          expiresAt,
          active,
        } satisfies BidView;
      })
      .filter(
        (item): item is BidView =>
          Boolean(item && item.active && item.bidder.toLowerCase() === me)
      );
  }, [bidsQuery.data, listingIds, bidder]);

  return { bids, isLoading: bidsQuery.isLoading };
}

export function useHighestBids(listingIds: bigint[]) {
  const bidsQuery = useReadContracts({
    contracts: listingIds.map((id) => ({
      address: MARKETPLACE_ADDRESS!,
      abi: marketplaceAbi,
      functionName: "getHighestBid",
      args: [id],
    })),
    query: { enabled: HAS_MARKETPLACE && listingIds.length > 0, refetchInterval: 6000 },
  });

  const bids = useMemo(() => {
    return (bidsQuery.data ?? [])
      .map((entry, idx) => {
        if (entry.status !== "success" || !entry.result) {
          return null;
        }
        const [bidder, amount, expiresAt, active] = entry.result as unknown as BidTuple;
        return {
          listingId: listingIds[idx],
          bidder,
          amount,
          expiresAt,
          active,
        } satisfies BidView;
      })
      .filter((item): item is BidView => Boolean(item && item.active));
  }, [bidsQuery.data, listingIds]);

  return { bids, isLoading: bidsQuery.isLoading };
}

export function useMyStats() {
  const { address } = useAccount();

  const statsQuery = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: marketplaceAbi,
    functionName: "getUserStats",
    args: address ? [address] : undefined,
    query: { enabled: HAS_MARKETPLACE && Boolean(address), refetchInterval: 6000 },
  });

  const [activeListings, activeBids, purchases] = (statsQuery.data as UserStatsTuple | undefined) ?? [
    0n,
    0n,
    0n,
  ];

  return {
    activeListings,
    activeBids,
    purchases,
    isLoading: statsQuery.isLoading,
  };
}

const listingCreatedEvent = parseAbiItem(
  "event ListingCreated(uint256 indexed listingId, address indexed seller, address indexed nft, uint256 tokenId, uint256 price)"
);
const listingBoughtEvent = parseAbiItem(
  "event ListingBought(uint256 indexed listingId, address indexed buyer, uint256 amount)"
);
const bidPlacedEvent = parseAbiItem(
  "event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount, uint64 expiresAt)"
);
const bidAcceptedEvent = parseAbiItem(
  "event BidAccepted(uint256 indexed listingId, address indexed seller, address indexed bidder, uint256 amount)"
);
const listingCancelledEvent = parseAbiItem(
  "event ListingCancelled(uint256 indexed listingId, address indexed seller)"
);

export function useMarketplaceActivity(onlyForAddress?: Address) {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!publicClient || !MARKETPLACE_ADDRESS || !HAS_MARKETPLACE) {
        return;
      }
      setIsLoading(true);
      try {
        const latest = await publicClient.getBlockNumber();
        const lookback = DEFAULT_CHAIN.id === 1 ? 12_000n : 50_000n;
        const fromBlock = latest > lookback ? latest - lookback : 0n;

        const [created, bought, placed, accepted, cancelled] = await Promise.all([
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listingCreatedEvent, fromBlock, toBlock: latest }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listingBoughtEvent, fromBlock, toBlock: latest }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: bidPlacedEvent, fromBlock, toBlock: latest }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: bidAcceptedEvent, fromBlock, toBlock: latest }),
          publicClient.getLogs({ address: MARKETPLACE_ADDRESS, event: listingCancelledEvent, fromBlock, toBlock: latest }),
        ]);

        const normalize = (addr?: string) => addr?.toLowerCase();
        const me = onlyForAddress ? onlyForAddress.toLowerCase() : undefined;

        const mapped: ActivityItem[] = [
          ...created.map((log) => ({
            id: `${log.transactionHash}-created`,
            kind: "listing_created" as const,
            listingId: (log.args as { listingId?: bigint }).listingId ?? 0n,
            actor: (log.args as { seller?: Address }).seller ?? "0x0000000000000000000000000000000000000000",
            amount: (log.args as { price?: bigint }).price,
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? "",
          })),
          ...bought.map((log) => ({
            id: `${log.transactionHash}-bought`,
            kind: "listing_bought" as const,
            listingId: (log.args as { listingId?: bigint }).listingId ?? 0n,
            actor: (log.args as { buyer?: Address }).buyer ?? "0x0000000000000000000000000000000000000000",
            amount: (log.args as { amount?: bigint }).amount,
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? "",
          })),
          ...placed.map((log) => ({
            id: `${log.transactionHash}-placed`,
            kind: "bid_placed" as const,
            listingId: (log.args as { listingId?: bigint }).listingId ?? 0n,
            actor: (log.args as { bidder?: Address }).bidder ?? "0x0000000000000000000000000000000000000000",
            amount: (log.args as { amount?: bigint }).amount,
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? "",
          })),
          ...accepted.map((log) => ({
            id: `${log.transactionHash}-accepted`,
            kind: "bid_accepted" as const,
            listingId: (log.args as { listingId?: bigint }).listingId ?? 0n,
            actor: (log.args as { seller?: Address }).seller ?? "0x0000000000000000000000000000000000000000",
            amount: (log.args as { amount?: bigint }).amount,
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? "",
          })),
          ...cancelled.map((log) => ({
            id: `${log.transactionHash}-cancelled`,
            kind: "listing_cancelled" as const,
            listingId: (log.args as { listingId?: bigint }).listingId ?? 0n,
            actor: (log.args as { seller?: Address }).seller ?? "0x0000000000000000000000000000000000000000",
            blockNumber: log.blockNumber ?? 0n,
            txHash: log.transactionHash ?? "",
          })),
        ]
          .filter((item) => (me ? normalize(item.actor) === me : true))
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, 12);

        if (active) {
          setItems(mapped);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [onlyForAddress, publicClient]);

  return { items, isLoading };
}
