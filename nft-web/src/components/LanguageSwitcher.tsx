import { useI18n, type Locale } from "../i18n";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  function select(next: Locale) {
    setLocale(next);
  }

  return (
    <div className="nft-lang" role="group" aria-label={t("lang.switch")}>
      <button
        type="button"
        className={`nft-lang__btn${locale === "en" ? " nft-lang__btn--active" : ""}`}
        onClick={() => select("en")}
        aria-pressed={locale === "en"}
      >
        {t("lang.en")}
      </button>
      <button
        type="button"
        className={`nft-lang__btn${locale === "ru" ? " nft-lang__btn--active" : ""}`}
        onClick={() => select("ru")}
        aria-pressed={locale === "ru"}
      >
        {t("lang.ru")}
      </button>
    </div>
  );
}
