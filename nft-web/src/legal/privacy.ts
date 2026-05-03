import type { LocalizedLegal } from "./types";

export const privacy: LocalizedLegal = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: 3 May 2026",
    disclaimer:
      "This document is a practical template for a web3 marketplace front-end. It does not replace legal advice. Have it reviewed by qualified counsel before relying on it in disputes or regulatory filings.",
    sections: [
      {
        heading: "1. Introduction",
        paragraphs: [
          "This Privacy Policy describes how the Geneso web application (the “Site”) processes information when you use the curated NFT marketplace interface.",
          "The Site connects your browser to public blockchain networks (currently Ethereum mainnet). It does not replace your wallet, custody your assets, or execute transactions without your confirmation in a wallet you control.",
        ],
      },
      {
        heading: "2. Who is responsible",
        paragraphs: [
          "The party operating this Site (“we”, “us”) is responsible for the processing described here. A dedicated contact channel for privacy-related requests will be published on this Site when available.",
        ],
      },
      {
        heading: "3. Categories of information",
        paragraphs: [
          "3.1. Wallet and on-chain data. When you connect a wallet, your public address and all transaction data you submit are broadcast to the blockchain. Blockchains are public ledgers: this information is visible to anyone and is not erasable by us.",
          "3.2. Technical data. We (and our hosting providers) may process server logs, IP address, user agent, timestamps, and similar metadata needed to deliver the Site securely and to diagnose errors.",
          "3.3. Local storage. The Site may store your language preference (e.g. English or Russian) in your browser (localStorage) so the interface remembers your choice.",
          "3.4. Optional WalletConnect. If you use WalletConnect, the WalletConnect service and your mobile wallet provider process additional data under their own policies.",
        ],
      },
      {
        heading: "4. Purposes and legal bases (EEA/UK-style summary)",
        paragraphs: [
          "Where the GDPR applies, we rely on: performance of a contract / steps at your request (providing the interface); legitimate interests (security, fraud prevention, improvement); consent where required (e.g. non-essential cookies or marketing, if introduced later).",
        ],
      },
      {
        heading: "5. Users in the Russian Federation",
        paragraphs: [
          "If Russian Federal Law No. 152-FZ on personal data applies, we process data in line with its requirements. You may exercise rights provided by that law, including requests for information, rectification, blocking, or deletion where grounds exist, withdrawal of consent, and complaints to the competent authority.",
          "Public wallet addresses and on-chain records are visible to everyone. They may still be treated as personal data if they can be linked to an identifiable person. The Site does not require your full name, phone number, or e-mail to browse or connect a wallet.",
        ],
      },
      {
        heading: "6. Processors and third parties",
        paragraphs: [
          "Infrastructure (e.g. static hosting such as Vercel, or a VPS with nginx), analytics (if enabled in the future), and RPC/node providers may process technical data on our behalf under agreements. Blockchain networks and wallet software operate independently of us.",
        ],
      },
      {
        heading: "7. Transfers outside your country",
        paragraphs: [
          "Hosting and service providers may be located outside your country. Where required, we use appropriate safeguards (e.g. standard contractual clauses) or rely on derogations.",
        ],
      },
      {
        heading: "8. Retention",
        paragraphs: [
          "Server logs: typically retained for a limited period for security and debugging. Local language preference: until you clear site data. Blockchain records: retained permanently on-chain by design.",
        ],
      },
      {
        heading: "9. Your rights",
        paragraphs: [
          "Depending on applicable law, you may have rights to access, rectify, delete, restrict, port, or object to certain processing, and to lodge a complaint with a supervisory authority. On-chain data cannot be deleted by us once confirmed on the network. How to reach us for such requests will be indicated on this Site when a contact channel is published.",
        ],
      },
      {
        heading: "10. Children",
        paragraphs: [
          "The Site is not directed at children. If you believe a child has provided personal information, please use the contact channel once it is published on this Site.",
        ],
      },
      {
        heading: "11. Changes",
        paragraphs: [
          "We may update this Policy. The “Last updated” date will change; continued use after updates constitutes acceptance where permitted by law.",
        ],
      },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    updated: "Дата обновления: 3 мая 2026 г.",
    disclaimer:
      "Текст носит информационный характер и не заменяет индивидуальную юридическую консультацию. Перед публикацией и спорами документ следует согласовать с юристом.",
    sections: [
      {
        heading: "1. Общие положения",
        paragraphs: [
          "Настоящая Политика описывает обработку информации при использовании веб-приложения Geneso («Сайт») — интерфейса кураторского NFT-маркетплейса.",
          "Сайт подключает ваш браузер к публичным блокчейн-сетям (в настоящее время Ethereum mainnet). Мы не являемся кастодианом активов и не подписываем транзакции без вашего подтверждения в кошельке.",
        ],
      },
      {
        heading: "2. Оператор",
        paragraphs: [
          "Оператором в смысле обработки данных при использовании Сайта является лицо, осуществляющее размещение данного интерфейса. Контакт для запросов по настоящей Политике и персональным данным будет опубликован на Сайте позже.",
        ],
      },
      {
        heading: "3. Какие данные обрабатываются",
        paragraphs: [
          "3.1. Данные кошелька и блокчейна. Публичный адрес и транзакции, которые вы инициируете, передаются в сеть Ethereum и доступны неограниченному кругу лиц. Удалить или изменить запись в блокчейне после подтверждения мы не можем.",
          "3.2. Технические данные: IP-адрес, User-Agent, время запроса, журналы веб-сервера / хостинга — для обеспечения работы, безопасности и устранения сбоев.",
          "3.3. Локальное хранилище браузера: предпочтение языка интерфейса (localStorage).",
          "3.4. Опционально WalletConnect — обработка данных осуществляется также по правилам WalletConnect и поставщика мобильного кошелька.",
        ],
      },
      {
        heading: "4. Цели обработки",
        paragraphs: [
          "Отображение интерфейса маркетплейса, подключение кошелька, взаимодействие со смарт-контрактами, обеспечение безопасности, соблюдение закона, ответы на обращения пользователей.",
        ],
      },
      {
        heading: "5. Правовые основания (РФ, 152-ФЗ)",
        paragraphs: [
          "Обработка персональных данных (в объёме, в котором адрес кошелька и иные сведения могут считаться персональными данными) осуществляется с соблюдением требований Федерального закона № 152-ФЗ «О персональных данных», в том числе на основании согласия субъекта, исполнения соглашения и законных интересов оператора в части безопасности сервиса.",
          "Субъект персональных данных вправе получить сведения об обработке, потребовать уточнения, блокирования или уничтожения данных при наличии оснований, отозвать согласие и обратиться с жалобой в Роскомнадзор.",
        ],
      },
      {
        heading: "6. Передача третьим лицам",
        paragraphs: [
          "Данные могут обрабатываться хостинг-провайдерами (например, Vercel или VPS), поставщиками RPC, при использовании WalletConnect — указанными сервисами. Продажа персональных данных не осуществляется.",
        ],
      },
      {
        heading: "7. Трансграничная передача",
        paragraphs: [
          "Серверы провайдеров могут находиться за пределами РФ. При необходимости обеспечивается соблюдение требований законодательства о трансграничной передаче.",
        ],
      },
      {
        heading: "8. Сроки хранения",
        paragraphs: [
          "Журналы сервера — ограниченный срок, необходимый для безопасности. Настройки языка в браузере — до их удаления пользователем. Данные в блокчейне хранятся неопределённо долго в сети.",
        ],
      },
      {
        heading: "9. Права пользователя",
        paragraphs: [
          "Вы можете запросить информацию об обработке и реализовать права, предусмотренные применимым правом. Записи в блокчейне оператор Сайта изменить не может. Способ обращения будет указан на Сайте после публикации контактных данных.",
        ],
      },
      {
        heading: "10. Дети",
        paragraphs: [
          "Сайт не рассчитан на несовершеннолетних. Если вы считаете, что ребёнок передал персональные данные, напишите нам.",
        ],
      },
      {
        heading: "11. Изменения Политики",
        paragraphs: [
          "Мы можем обновлять Политику. Актуальная версия размещается на Сайте; дата обновления указывается в начале документа.",
        ],
      },
    ],
  },
};
