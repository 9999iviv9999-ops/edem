import { formatEther } from "viem";

export function formatEth(value: bigint) {
  return Number(formatEther(value)).toFixed(4);
}

export function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

/** Ethereum mainnet — Etherscan (app uses `mainnet` only in `web3/config.ts`). */
export function explorerTxUrl(_chainId: number, hash: string) {
  return `https://etherscan.io/tx/${hash}`;
}
