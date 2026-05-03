import { isAddress } from "viem";

type MaybeAddress = `0x${string}` | undefined;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function getAddressFromEnv(value: string | undefined): MaybeAddress {
  if (!value) {
    return undefined;
  }
  if (value.toLowerCase() === ZERO_ADDRESS) {
    return undefined;
  }
  return isAddress(value) ? (value as `0x${string}`) : undefined;
}

export const MARKETPLACE_ADDRESS = getAddressFromEnv(
  import.meta.env.VITE_MARKETPLACE_ADDRESS
);

export const NFT_COLLECTION_ADDRESS = getAddressFromEnv(
  import.meta.env.VITE_NFT_COLLECTION_ADDRESS
);

export const HAS_MARKETPLACE = Boolean(MARKETPLACE_ADDRESS);
