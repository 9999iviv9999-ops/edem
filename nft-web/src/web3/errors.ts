/**
 * Turn wallet / RPC errors into short, calm copy for the UI.
 */
import type { MessageKey } from "../i18n/locales/en";
import { DEFAULT_CHAIN } from "./config";

export type ErrorTranslator = (
  key: MessageKey,
  vars?: Record<string, string | number>
) => string;

export function formatUserError(
  err: unknown,
  gentleFallback: string,
  t: ErrorTranslator
): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const chain = DEFAULT_CHAIN.name;

  if (/user rejected|User denied|rejected the request|4001|ACTION_REJECTED/i.test(msg)) {
    return t("errors.userRejected");
  }
  if (/insufficient funds/i.test(msg)) {
    return t("errors.insufficientFunds");
  }
  if (/wrong network|chain id|switch chain|CHAIN_MISMATCH/i.test(msg)) {
    return t("errors.wrongNetwork", { chain });
  }
  if (/nonce too low|replacement fee|underpriced|already known/i.test(msg)) {
    return t("errors.noncePending");
  }
  if (/execution reverted|revert/i.test(msg)) {
    return t("errors.executionReverted");
  }
  if (/network|timeout|fetch failed|rpc|rate limit|ECONNRESET/i.test(msg)) {
    return t("errors.rpcIssue");
  }

  if (msg && msg.length > 0 && msg.length < 160 && !/^0x[a-fA-F0-9]{64}$/.test(msg.trim())) {
    return msg;
  }

  return gentleFallback;
}
