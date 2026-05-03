import { Component, type ErrorInfo, type ReactNode } from "react";
import { detectLocale, type Locale } from "../i18n/locale";
import type { MessageKey } from "../i18n/locales/en";
import { en } from "../i18n/locales/en";
import { ru } from "../i18n/locales/ru";

type Props = { children: ReactNode };

type State = { hasError: boolean };

const BUNDLE: Record<Locale, Record<MessageKey, string>> = {
  en: en as Record<MessageKey, string>,
  ru: ru as Record<MessageKey, string>,
};

function t(locale: Locale, key: MessageKey): string {
  return BUNDLE[locale][key] ?? BUNDLE.en[key] ?? key;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* optional: send to logging */
  }

  render() {
    if (this.state.hasError) {
      const locale = detectLocale();
      return (
        <div className="nft-error-boundary">
          <h1 className="nft-error-boundary__title">{t(locale, "errorBoundary.title")}</h1>
          <p className="nft-error-boundary__text">{t(locale, "errorBoundary.body")}</p>
          <button
            type="button"
            className="nft-btn nft-btn--primary"
            onClick={() => window.location.reload()}
          >
            {t(locale, "errorBoundary.reload")}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
