import { useChainId, useWaitForTransactionReceipt } from "wagmi";
import { useI18n } from "../i18n";
import { formatUserError } from "../web3/errors";
import { explorerTxUrl } from "../web3/utils";

type Props = {
  hash: `0x${string}` | null;
  onDismiss: () => void;
};

export function TxStatusBanner({ hash, onDismiss }: Props) {
  const { t } = useI18n();
  const chainId = useChainId();
  const { data: receipt, isLoading, isError, error } = useWaitForTransactionReceipt({
    hash: hash ?? undefined,
    query: { enabled: Boolean(hash) },
  });

  if (!hash) {
    return null;
  }

  const url = explorerTxUrl(chainId, hash);
  const reverted = receipt?.status === "reverted";

  return (
    <div className="nft-tx-banner" role="status" aria-live="polite" aria-atomic="true">
      <p className="nft-muted">
        {t("tx.transaction")}{" "}
        <a href={url} target="_blank" rel="noreferrer" className="nft-link">
          {hash.slice(0, 10)}…
        </a>
      </p>
      {isLoading && <p className="nft-muted">{t("tx.waiting")}</p>}
      {isError && (
        <p className="nft-error">
          {formatUserError(error, t("errors.confirmTx"), t)}
        </p>
      )}
      {!isLoading && receipt && !reverted && (
        <p className="nft-success">{t("tx.confirmed", { block: receipt.blockNumber.toString() })}</p>
      )}
      {!isLoading && receipt && reverted && (
        <p className="nft-error">{t("tx.revert")}</p>
      )}
      <button type="button" className="nft-btn nft-btn--ghost nft-tx-banner__dismiss" onClick={onDismiss}>
        {t("tx.close")}
      </button>
    </div>
  );
}
