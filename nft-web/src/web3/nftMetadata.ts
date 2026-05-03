/** OpenSea-style ERC-721 metadata (subset). */
export type NftJsonMetadata = {
  name?: string;
  description?: string;
  image?: string;
  attributes?: readonly { trait_type?: string; value?: string | number }[];
};

/** Resolve ipfs://, ar:// to an HTTPS gateway URL for fetch/img src. */
export function resolveUri(uri: string): string {
  const u = uri.trim();
  if (u.startsWith("ipfs://")) {
    const path = u.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
    return `https://ipfs.io/ipfs/${path}`;
  }
  if (u.startsWith("ar://")) {
    return `https://arweave.net/${u.slice("ar://".length)}`;
  }
  return u;
}

/** Inline `data:application/json;base64,...` tokenURI (common on-chain metadata). */
export function metadataFromDataUri(tokenUri: string): NftJsonMetadata | null {
  const u = tokenUri.trim();
  if (!u.startsWith("data:application/json")) {
    return null;
  }
  try {
    const comma = u.indexOf(",");
    if (comma < 0) {
      return null;
    }
    const header = u.slice(0, comma);
    const payload = u.slice(comma + 1);
    const json =
      header.includes("base64") && typeof atob !== "undefined"
        ? atob(payload)
        : decodeURIComponent(payload);
    return JSON.parse(json) as NftJsonMetadata;
  } catch {
    return null;
  }
}

export async function fetchNftMetadata(tokenUri: string): Promise<NftJsonMetadata> {
  const url = resolveUri(tokenUri);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Metadata HTTP ${res.status}`);
  }
  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid metadata JSON");
  }
  return data as NftJsonMetadata;
}
