import { ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useChainId } from "wagmi";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { WalletButton } from "../components/WalletButton";
import { useI18n } from "../i18n";
import { DEFAULT_CHAIN } from "../web3/config";

type Props = {
  children: ReactNode;
};

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nft-nav__link nft-nav__link--active" : "nft-nav__link";
}

export function MarketplaceLayout({ children }: Props) {
  const chainId = useChainId();
  const { t } = useI18n();
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let page = t("nav.discover");
    if (path.startsWith("/bids")) {
      page = t("nav.offers");
    } else if (path.startsWith("/profile")) {
      page = t("nav.profile");
    } else if (path.startsWith("/item/")) {
      const id = path.slice("/item/".length).split("/")[0] || "—";
      page = t("item.breadcrumbListing", { id });
    } else if (path.startsWith("/privacy")) {
      page = t("footer.privacy");
    } else if (path.startsWith("/terms")) {
      page = t("footer.terms");
    } else if (path.startsWith("/cookies")) {
      page = t("footer.cookies");
    }
    document.title = t("meta.windowTitle", { page });
  }, [location.pathname, t]);

  return (
    <div className="nft-market">
      <header className="nft-header">
        <div className="nft-header__inner">
          <div className="nft-header__spacer" aria-hidden />
          <nav className="nft-nav" aria-label={t("nav.primary")}>
            <NavLink className={navClass} end to="/">
              {t("nav.discover")}
            </NavLink>
            <NavLink className={navClass} to="/bids">
              {t("nav.offers")}
            </NavLink>
            <NavLink className={navClass} to="/profile">
              {t("nav.profile")}
            </NavLink>
          </nav>
          <div className="nft-header__actions">
            <LanguageSwitcher />
            <span className="nft-chain-pill" title={t("header.networkTitle")}>
              <span className="nft-chain-pill__dot" />
              {chainId === DEFAULT_CHAIN.id ? DEFAULT_CHAIN.name : t("chain.fallback", { id: chainId })}
            </span>
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="nft-main">{children}</main>

      <footer className="nft-footer">
        <p className="nft-footer__tagline">{t("footer.text")}</p>
        <nav className="nft-footer__legal" aria-label={t("footer.legalNav")}>
          <a className="nft-footer__link" href="/guides/">
            {t("footer.guides")}
          </a>
          <span className="nft-footer__sep" aria-hidden>
            ·
          </span>
          <NavLink className="nft-footer__link" to="/privacy">
            {t("footer.privacy")}
          </NavLink>
          <span className="nft-footer__sep" aria-hidden>
            ·
          </span>
          <NavLink className="nft-footer__link" to="/terms">
            {t("footer.terms")}
          </NavLink>
          <span className="nft-footer__sep" aria-hidden>
            ·
          </span>
          <NavLink className="nft-footer__link" to="/cookies">
            {t("footer.cookies")}
          </NavLink>
        </nav>
      </footer>
    </div>
  );
}
