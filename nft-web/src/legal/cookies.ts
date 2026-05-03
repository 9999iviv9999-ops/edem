import type { LocalizedLegal } from "./types";

export const cookies: LocalizedLegal = {
  en: {
    title: "Cookie & storage notice",
    updated: "Last updated: 3 May 2026",
    disclaimer:
      "Short notice on how this Site uses browser storage. For full context see the Privacy Policy.",
    sections: [
      {
        heading: "1. What we use today",
        paragraphs: [
          "The Site uses localStorage to remember your language choice (English / Russian) under the key `geneso-locale`. This is functional storage, not advertising profiling.",
        ],
      },
      {
        heading: "2. Wallet and dapp connectors",
        paragraphs: [
          "Browser extensions (e.g. MetaMask) and WalletConnect may set their own cookies or storage. Those are governed by their respective policies.",
        ],
      },
      {
        heading: "3. Hosting and analytics",
        paragraphs: [
          "If we enable analytics or error reporting in the future, this notice will be updated and, where required, we will ask for consent before non-essential tracking.",
        ],
      },
      {
        heading: "4. Your choices",
        paragraphs: [
          "You can clear site data in your browser settings. Clearing storage may reset your language preference. A contact channel for questions will be published on this Site when available.",
        ],
      },
    ],
  },
  ru: {
    title: "Файлы cookie и локальное хранилище",
    updated: "Дата обновления: 3 мая 2026 г.",
    disclaimer:
      "Краткая информация об использовании хранилища браузера. Подробнее — в Политике конфиденциальности.",
    sections: [
      {
        heading: "1. Что используется сейчас",
        paragraphs: [
          "Сайт сохраняет в localStorage выбранный язык интерфейса (EN/RU), ключ `geneso-locale`. Это технически необходимая настройка, а не рекламный профиль.",
        ],
      },
      {
        heading: "2. Кошелёк и сторонние сервисы",
        paragraphs: [
          "Расширения кошелька (например, MetaMask) и WalletConnect могут использовать собственные cookie и хранилище — на условиях их политик.",
        ],
      },
      {
        heading: "3. Аналитика",
        paragraphs: [
          "При подключении аналитики или отчётов об ошибках настоящее уведомление будет обновлено; при необходимости будет запрошено согласие на не существенные для работы Сайта технологии.",
        ],
      },
      {
        heading: "4. Ваш выбор",
        paragraphs: [
          "Вы можете удалить данные сайта в настройках браузера; настройка языка может сброситься. Контакт для вопросов будет опубликован на Сайте позже.",
        ],
      },
    ],
  },
};
