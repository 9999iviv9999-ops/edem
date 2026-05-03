import type { MessageKey } from "./en";

export const ru = {
  "nav.discover": "Витрина",
  "nav.offers": "Предложения",
  "nav.profile": "Профиль",
  "nav.primary": "Основная навигация",

  "brand.tagline": "Кураторские эзотерические NFT",
  "brand.logoAlt": "Geneso — главная, эзотерический NFT-маркетплейс",

  "header.networkTitle": "Подключённая сеть",
  "footer.text":
    "Geneso · Кураторские эзотерические NFT · Проверенные авторы · Владение в блокчейне",
  "footer.legalNav": "Правовая информация",
  "footer.privacy": "Конфиденциальность",
  "footer.terms": "Условия",
  "footer.cookies": "Cookie",
  "footer.guides": "Руководства",

  "lang.en": "EN",
  "lang.ru": "RU",
  "lang.switch": "Язык",

  "wallet.connect": "Подключите кошелёк",
  "wallet.connecting": "Подключение…",
  "wallet.stuckHint":
    " — Откройте MetaMask и подтвердите или отклоните ожидающий запрос. Если зависло: MetaMask → ⋮ → Подключённые сайты → отключите этот сайт и подключите снова в сети {{chain}}.",

  "market.discoverTitle": "Витрина",
  "market.discoverLede":
    "Открывайте и коллекционируйте осмысленные эзотерические NFT: таро, астрология, руны, сакральная геометрия и духовное цифровое искусство — для авторов и коллекционеров.",
  "market.network": "Сеть",
  "market.fee": "Сбор",
  "market.listed": "В списке",
  "market.searchPlaceholder": "Поиск по категории, свойству или автору (скоро)",
  "market.toolbarMeta": "Листинги в блокчейне · Кураторский эзотерический маркетплейс",
  "market.listTitle": "Выставьте работу",
  "market.listLede":
    "Один раз разрешите Geneso владеть вашим токеном, затем укажите фиксированную цену в ETH. Тот же ончейн-процесс, что у крупных площадок, в более спокойной подаче.",
  "market.tokenId": "ID токена",
  "market.priceEth": "Цена в ETH",
  "market.authorizePublish": "Разрешить и опубликовать",
  "market.publishing": "Публикация…",
  "market.loadingListings": "Загрузка листингов…",
  "market.noListings": "Пока нет листингов. Предложите первую работу кругу.",
  "market.listingPrice": "Цена листинга",
  "market.listingLine": "Листинг #{{id}} · {{nft}}",
  "market.from": "От {{addr}}{{you}}",
  "market.youListed": " · Вы выставили",
  "market.viewListing": "Открыть листинг",
  "market.collectNow": "Купить сейчас",
  "market.offerEth": "Предложение (ETH)",
  "market.placeOffer": "Сделать предложение",
  "market.withdrawListing": "Снять с продажи",
  "market.badgeErc721": "ERC-721",

  "bids.title": "Предложения",
  "bids.lede":
    "Активные предложения по кураторским коллекциям. Продавцы могут принять ставку, покупатели — отозвать до принятия.",
  "bids.loading": "Загрузка предложений…",
  "bids.noOffers": "Сейчас нет активных предложений.",
  "bids.listingHeading": "Листинг #{{id}}",
  "bids.amountFrom": "{{amount}} ETH от {{addr}}",
  "bids.offerFrom": "от {{addr}}",
  "bids.seller": "Продавец",
  "bids.status": "Статус",
  "bids.active": "Активно",
  "bids.inactive": "Неактивно",
  "bids.acceptOffer": "Принять предложение",
  "bids.withdrawOffer": "Отозвать предложение",

  "profile.title": "Профиль",
  "profile.lede":
    "Кошелёк, ваши листинги, предложения и недавняя активность в экосистеме Geneso.",
  "profile.wallet": "Кошелёк",
  "profile.status": "Статус",
  "profile.connected": "Подключён",
  "profile.notConnected": "Не подключён",
  "profile.stats": "Статистика",
  "profile.loading": "Загрузка…",
  "profile.activeListings": "Активные листинги",
  "profile.activeOffers": "Активные предложения",
  "profile.purchases": "Покупки",
  "profile.yourListings": "Ваши листинги",
  "profile.noListings": "Нет активных листингов.",
  "profile.yourOffers": "Ваши предложения",
  "profile.noOffers": "Нет активных предложений.",
  "profile.listingToken": "Листинг #{{id}} · #{{tokenId}}",
  "profile.topOffer": "Лучшее предложение: {{amount}} ETH · {{addr}}",
  "profile.yourActivity": "Ваша активность",
  "profile.noActivity": "Нет недавних событий для этого кошелька.",
  "profile.globalActivity": "Общая активность",
  "profile.noGlobalActivity": "Нет недавних событий маркетплейса.",
  "profile.copyAddress": "Скопировать адрес",
  "profile.addressCopied": "Скопировано",

  "activity.listed": "Выставлено",
  "activity.sold": "Продано",
  "activity.offerPlaced": "Предложение",
  "activity.offerAccepted": "Предложение принято",
  "activity.listingCancelled": "Листинг отменён",
  "activity.line": "#{{id}} · {{kind}}{{amount}}",

  "item.invalidId": "Некорректный ID листинга.",
  "item.backDiscover": "← Назад к витрине",
  "item.loading": "Загрузка листинга…",
  "item.notActive": "Листинг неактивен или не существует.",
  "item.breadcrumbDiscover": "Витрина",
  "item.breadcrumbListing": "Листинг #{{id}}",
  "item.lede":
    "Кураторский листинг на Geneso · Контракт {{nft}} · Продавец {{seller}}",
  "item.metadataError": "Не удалось загрузить метаданные (проверьте token URI или шлюз).",
  "item.trait": "Свойство",
  "item.leadingOffer": "Ведущее предложение",
  "item.expires": "Истекает {{date}}",

  "tx.transaction": "Транзакция",
  "tx.waiting": "Ожидание подтверждения…",
  "tx.confirmed": "Подтверждено в блоке {{block}}.",
  "tx.revert":
    "Транзакция откатилась. Проверьте листинг, разрешения и сеть.",
  "tx.close": "Закрыть",

  "errors.missingMarketplace":
    "Задайте VITE_MARKETPLACE_ADDRESS (и VITE_NFT_COLLECTION_ADDRESS для листинга) в nft-web/.env локально или в переменных окружения проекта Vercel для продакшена, затем выполните redeploy.",
  "errors.userRejected": "Вы закрыли кошелёк без подтверждения. Изменений нет.",
  "errors.insufficientFunds":
    "Недостаточно ETH для этой операции (включая газ).",
  "errors.wrongNetwork": "Переключите кошелёк на сеть {{chain}} и повторите.",
  "errors.noncePending":
    "Предыдущая транзакция может быть в очереди. Подождите или сбросьте nonce в кошельке при необходимости.",
  "errors.executionReverted":
    "Контракт не выполнил операцию. Проверьте разрешения, листинг, цену и сеть.",
  "errors.rpcIssue":
    "Сеть или RPC недоступны. Проверьте соединение и повторите через несколько секунд.",
  "errors.buy": "Не удалось завершить покупку.",
  "errors.bid": "Не удалось отправить предложение.",
  "errors.withdrawListing": "Не удалось снять листинг.",
  "errors.publish": "Не удалось опубликовать листинг.",
  "errors.acceptBid": "Не удалось принять предложение.",
  "errors.cancelBid": "Не удалось отозвать предложение.",
  "errors.txFailed": "Транзакция не прошла.",
  "errors.confirmTx": "Не удалось подтвердить транзакцию в сети.",
  "errors.copyFailed": "Не удалось скопировать в буфер.",

  "chain.fallback": "Сеть {{id}}",

  "meta.windowTitle": "{{page}} · Geneso",

  "errorBoundary.title": "Что-то пошло не так",
  "errorBoundary.body":
    "Обновите страницу. Если ошибка повторяется, очистите кэш сайта или обновите браузер.",
  "errorBoundary.reload": "Обновить страницу",
} as const satisfies Record<MessageKey, string>;
