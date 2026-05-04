import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useI18n } from "../i18n";
import { DEFAULT_CHAIN, WALLET_CONNECT_CONFIGURED } from "../web3/config";
import { shortAddress } from "../web3/utils";

function hasBrowserEthereum(): boolean {
  return typeof window !== "undefined" && Boolean((window as unknown as { ethereum?: unknown }).ethereum);
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function WalletButton() {
  const { t } = useI18n();
  const connectErrorHint = useCallback(
    (message: string) => {
      const m = message.toLowerCase();
      if (
        m.includes("pending") ||
        m.includes("already") ||
        m.includes("ожидан") ||
        m.includes("уже")
      ) {
        return `${message}${t("wallet.stuckHint", { chain: DEFAULT_CHAIN.name })}`;
      }
      return message;
    },
    [t]
  );

  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const connectLock = useRef(false);

  const mobileNeedsWalletConnect = useMemo(
    () => isMobileUserAgent() && !hasBrowserEthereum() && !WALLET_CONNECT_CONFIGURED,
    []
  );

  const singleConnector = connectors.length === 1 ? connectors[0] : null;
  const shouldAutoConnectSingle =
    Boolean(singleConnector) &&
    (singleConnector!.id === "walletConnect" || hasBrowserEthereum());

  useEffect(() => {
    if (!isPending) {
      connectLock.current = false;
    }
  }, [isPending]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (isConnected && address) {
    return (
      <button type="button" className="nft-btn nft-btn--outline" onClick={() => disconnect()}>
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <div className="nft-wallet" ref={wrapRef}>
      <button
        type="button"
        className="nft-btn nft-btn--primary"
        onClick={(e) => {
          e.stopPropagation();
          if (connectLock.current || isPending) return;
          if (connectors.length === 1) {
            connectLock.current = true;
            connect(
              { connector: connectors[0] },
              { onSettled: () => void (connectLock.current = false) }
            );
            return;
          }
          setMenuOpen((o) => !o);
        }}
        disabled={isPending || connectors.length === 0}
      >
        {isPending ? t("wallet.connecting") : t("wallet.connect")}
      </button>
      {mobileNeedsWalletConnect ? (
        <p className="nft-wallet__hint" role="note">
          {t("wallet.mobileWalletConnectRequired")}
        </p>
      ) : null}
      {error ? (
        <p className="nft-wallet__error" role="status">
          {connectErrorHint(error.message)}
        </p>
      ) : null}
      {menuOpen &&
        connectors.length > 0 &&
        !(connectors.length === 1 && shouldAutoConnectSingle) && (
        <ul className="nft-wallet__menu" role="menu">
          {connectors.map((connector) => (
            <li key={connector.uid}>
              <button
                type="button"
                className="nft-wallet__menu-item"
                role="menuitem"
                disabled={isPending}
                onClick={() => {
                  if (connectLock.current || isPending) return;
                  connectLock.current = true;
                  connect(
                    { connector },
                    {
                      onSettled: () => {
                        connectLock.current = false;
                      },
                    }
                  );
                  setMenuOpen(false);
                }}
              >
                {connector.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
