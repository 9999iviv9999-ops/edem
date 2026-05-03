import type { Locale } from "../i18n/locale";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  updated: string;
  disclaimer: string;
  sections: LegalSection[];
};

export type LocalizedLegal = Record<Locale, LegalDocument>;
