import type { Address } from "viem";

export type SellerSocialLinks = {
  telegram?: string;
  x?: string;
  instagram?: string;
  website?: string;
};

const KEY_PREFIX = "geneso-seller-social:";

function keyFor(address: Address) {
  return `${KEY_PREFIX}${address.toLowerCase()}`;
}

function normalizeHandle(v: string): string {
  return v.trim().replace(/^@+/, "");
}

function normalizeUrl(v: string): string {
  const t = v.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export function normalizeSellerSocial(input: SellerSocialLinks): SellerSocialLinks {
  const telegram = normalizeHandle(input.telegram ?? "");
  const x = normalizeHandle(input.x ?? "");
  const instagram = normalizeHandle(input.instagram ?? "");
  const website = normalizeUrl(input.website ?? "");
  return {
    telegram: telegram || undefined,
    x: x || undefined,
    instagram: instagram || undefined,
    website: website || undefined,
  };
}

export function sellerSocialHref(kind: keyof SellerSocialLinks, value?: string): string | null {
  if (!value) return null;
  if (kind === "telegram") return `https://t.me/${value}`;
  if (kind === "x") return `https://x.com/${value}`;
  if (kind === "instagram") return `https://instagram.com/${value}`;
  return value;
}

export function readSellerSocial(address?: Address): SellerSocialLinks {
  if (!address || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SellerSocialLinks;
    return normalizeSellerSocial(parsed);
  } catch {
    return {};
  }
}

export function writeSellerSocial(address: Address, social: SellerSocialLinks) {
  if (typeof window === "undefined") return;
  const normalized = normalizeSellerSocial(social);
  window.localStorage.setItem(keyFor(address), JSON.stringify(normalized));
}
