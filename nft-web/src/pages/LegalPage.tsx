import { useI18n } from "../i18n";
import { cookies } from "../legal/cookies";
import { privacy } from "../legal/privacy";
import { terms } from "../legal/terms";

const DOCS = {
  privacy,
  terms,
  cookies,
} as const;

export type LegalDocId = keyof typeof DOCS;

type Props = {
  doc: LegalDocId;
};

export function LegalPage({ doc }: Props) {
  const { locale } = useI18n();
  const content = DOCS[doc][locale];

  return (
    <article className="nft-legal">
      <header className="nft-page-head">
        <h1 className="nft-page-title">{content.title}</h1>
        <p className="nft-legal__updated">{content.updated}</p>
        <p className="nft-legal__disclaimer">{content.disclaimer}</p>
      </header>
      {content.sections.map((section, i) => (
        <section key={i} className="nft-legal__section">
          <h2 className="nft-legal__h2">{section.heading}</h2>
          {section.paragraphs.map((p, j) => (
            <p key={j} className="nft-legal__p">
              {p}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
