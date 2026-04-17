import { FormEvent, useMemo, useState } from "react";
import { VprokLogo } from "../components/VprokLogo";
import { CropAspect, cropAndCompressImageFile, validateProductImage } from "../lib/imageUpload";

type Retailer = {
  id: string;
  email: string;
  password: string;
  legalName: string;
  disputeEmail: string;
  workRules: string;
  substitutionRules: string;
  pickupRules: string;
  products: Product[];
};

type Buyer = {
  id: string;
  email: string;
  phone: string;
  password: string;
  name: string;
  createdAt: number;
};

type Product = {
  id: string;
  title: string;
  imageUrl?: string;
  unit: string;
  priceCents: number;
  shelfDays: number;
};

type Order = {
  id: string;
  buyerId: string;
  retailerId: string;
  pickupMonths: number;
  pickupDeadlineLabel: string;
  items: Array<{ productId: string; qty: number; title: string; subtotalCents: number }>;
  totalCents: number;
  status: "paid" | "fulfilled" | "refunded";
  createdAt: number;
};

const seedRetailers: Retailer[] = [
  {
    id: "r-1",
    email: "retailer1@vprok.demo",
    password: "123456",
    legalName: "Партнер 001",
    disputeEmail: "claims001@vprok.demo",
    workRules: "Оплата онлайн, выдача по QR-коду, срок хранения обязательства до 180 дней.",
    substitutionRules: "Если нет точного SKU, предоставляется эквивалент той же массы и категории либо возврат.",
    pickupRules: "Выдача доступна в часы работы точки. Нужен код заказа.",
    products: [
      { id: "p-1", title: "Сахар-песок 1 кг", unit: "кг", priceCents: 9900, shelfDays: 360 },
      { id: "p-2", title: "Рис 1 кг", unit: "кг", priceCents: 14500, shelfDays: 360 }
    ]
  },
  {
    id: "r-2",
    email: "retailer2@vprok.demo",
    password: "123456",
    legalName: "Партнер 002",
    disputeEmail: "claims002@vprok.demo",
    workRules: "Оплата фиксирует цену. Минимальный срок до получения — 7 дней.",
    substitutionRules: "Замена только на эквивалентный товар, ухудшение характеристик не допускается.",
    pickupRules: "Получение лично покупателем или доверенным лицом с кодом.",
    products: [{ id: "p-3", title: "Гречка 800 г", unit: "шт", priceCents: 12900, shelfDays: 300 }]
  }
];

const seedBuyers: Buyer[] = [
  {
    id: "b-1",
    email: "buyer@vprok.demo",
    phone: "+79990000001",
    password: "123456",
    name: "Покупатель Demo",
    createdAt: Date.now() - 86400000
  }
];

const NEW_ACCOUNT_DAYS = 14;
const NEW_ACCOUNT_MAX_ORDER_CENTS = 50000;
const NEW_ACCOUNT_MAX_DAILY_CENTS = 120000;
const NEW_ACCOUNT_MAX_ORDERS_PER_DAY = 3;
const ORDER_COOLDOWN_MS = 30000;

const money = (cents: number) => `${(cents / 100).toFixed(2)} ₽`;

export function VprokPreviewPage() {
  const [retailers, setRetailers] = useState<Retailer[]>(seedRetailers);
  const [buyers, setBuyers] = useState<Buyer[]>(seedBuyers);
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState<"buyer" | "retailer">("buyer");
  const [buyerId, setBuyerId] = useState<string>(seedBuyers[0].id);
  const [retailerId, setRetailerId] = useState<string>(seedRetailers[0].id);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pickupMonths, setPickupMonths] = useState<number>(3);
  const [acceptedRules, setAcceptedRules] = useState<boolean>(false);
  const [buyerStep, setBuyerStep] = useState<1 | 2 | 3 | 4>(1);
  const [buyerLastPaymentAt, setBuyerLastPaymentAt] = useState<Record<string, number>>({});

  const [buyerForm, setBuyerForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [retailerForm, setRetailerForm] = useState({
    legalName: "",
    email: "",
    password: "",
    disputeEmail: "",
    workRules: "",
    substitutionRules: "",
    pickupRules: ""
  });
  const [productForm, setProductForm] = useState({
    title: "",
    imageUrl: "",
    unit: "шт",
    priceCents: "10000",
    shelfDays: "180"
  });
  const [selectedRetailerForBuyer, setSelectedRetailerForBuyer] = useState<string>(seedRetailers[0].id);
  const [onboardingRetailerId, setOnboardingRetailerId] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState<CropAspect>("4:3");

  const catalog = useMemo(
    () => {
      const chosen = retailers.find((r) => r.id === selectedRetailerForBuyer);
      if (!chosen) return [];
      return chosen.products.map((p) => ({
        ...p,
        retailerId: chosen.id,
        retailerLabel: `Ритейлер ${chosen.id.slice(-1)}`
      }));
    },
    [retailers, selectedRetailerForBuyer]
  );

  const total = useMemo(
    () => catalog.reduce((sum, p) => sum + p.priceCents * (cart[p.id] || 0), 0),
    [catalog, cart]
  );

  const currentRetailer = retailers.find((r) => r.id === retailerId);
  const buyerRetailer = retailers.find((r) => r.id === selectedRetailerForBuyer);
  const currentBuyer = buyers.find((b) => b.id === buyerId);
  const rulesCompleted = Boolean(
    currentRetailer?.workRules?.trim() &&
      currentRetailer?.substitutionRules?.trim() &&
      currentRetailer?.pickupRules?.trim()
  );
  const hasRetailerStep = Boolean(buyerRetailer);
  const hasRulesStep = Boolean(acceptedRules);
  const hasPickupStep = pickupMonths >= 1 && pickupMonths <= 12;
  const hasProductsStep = total > 0;

  const buyerOrders = orders.filter((o) => o.buyerId === buyerId);
  const now = Date.now();
  const isNewBuyer = currentBuyer ? now - currentBuyer.createdAt < NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000 : false;
  const orders24h = buyerOrders.filter((o) => now - o.createdAt < 24 * 60 * 60 * 1000);
  const dailySpendCents = orders24h.reduce((sum, o) => sum + o.totalCents, 0);

  function changeQty(productId: string, delta: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  }

  function registerBuyer(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!buyerForm.name || !buyerForm.email || !buyerForm.phone || !buyerForm.password) {
      setError("Заполни все поля покупателя (имя, email, телефон, пароль)");
      return;
    }
    const next: Buyer = {
      id: `b-${Date.now()}`,
      name: buyerForm.name,
      email: buyerForm.email,
      phone: buyerForm.phone,
      password: buyerForm.password,
      createdAt: Date.now()
    };
    setBuyers((prev) => [next, ...prev]);
    setBuyerId(next.id);
    setBuyerForm({ name: "", email: "", phone: "", password: "" });
    setMessage("Покупатель зарегистрирован и вошел в систему.");
  }

  function registerRetailer(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!retailerForm.legalName || !retailerForm.email || !retailerForm.password || !retailerForm.disputeEmail) {
      setError("Заполни основные поля ритейлера");
      return;
    }
    const next: Retailer = {
      id: `r-${Date.now()}`,
      legalName: retailerForm.legalName,
      email: retailerForm.email,
      password: retailerForm.password,
      disputeEmail: retailerForm.disputeEmail,
      workRules: "",
      substitutionRules: "",
      pickupRules: "",
      products: []
    };
    setRetailers((prev) => [next, ...prev]);
    setRetailerId(next.id);
    setOnboardingRetailerId(next.id);
    setRetailerForm({
      legalName: "",
      email: "",
      password: "",
      disputeEmail: "",
      workRules: "",
      substitutionRules: "",
      pickupRules: ""
    });
    setMessage("Шаг 1/3 выполнен. Теперь обязательно заполни правила работы ритейлера.");
  }

  function saveRetailerRules(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!currentRetailer) return;
    if (!retailerForm.workRules || !retailerForm.substitutionRules || !retailerForm.pickupRules) {
      setError("Заполни все обязательные правила ритейлера");
      return;
    }
    setRetailers((prev) =>
      prev.map((r) =>
        r.id === currentRetailer.id
          ? {
              ...r,
              workRules: retailerForm.workRules.trim(),
              substitutionRules: retailerForm.substitutionRules.trim(),
              pickupRules: retailerForm.pickupRules.trim()
            }
          : r
      )
    );
    setRetailerForm((s) => ({ ...s, workRules: "", substitutionRules: "", pickupRules: "" }));
    setOnboardingRetailerId(null);
    setMessage("Шаг 2/3 выполнен. Теперь можно публиковать товары.");
  }

  function addProduct(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!currentRetailer) return;
    if (!rulesCompleted) {
      setError("Публикация заблокирована: сначала заполни и сохрани правила ритейлера (шаг 2/3).");
      return;
    }
    const product: Product = {
      id: `p-${Date.now()}`,
      title: productForm.title,
      imageUrl: productForm.imageUrl || undefined,
      unit: productForm.unit,
      priceCents: Number(productForm.priceCents),
      shelfDays: Number(productForm.shelfDays)
    };
    if (!product.title || !product.unit || !product.priceCents || !product.shelfDays) {
      setError("Заполни корректно поля товара");
      return;
    }
    setRetailers((prev) =>
      prev.map((r) => (r.id === currentRetailer.id ? { ...r, products: [product, ...r.products] } : r))
    );
    setProductForm({ title: "", imageUrl: "", unit: "шт", priceCents: "10000", shelfDays: "180" });
    setMessage("Товар опубликован.");
  }

  function onDemoProductImageSelected(file: File | null) {
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    const reader = new FileReader();
    cropAndCompressImageFile(file, imageAspect)
      .then((compressed) => {
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          setProductForm((s) => ({ ...s, imageUrl: result }));
          setMessage("Фото товара добавлено (sandbox).");
        };
        reader.readAsDataURL(compressed);
      })
      .catch(() => setError("Не удалось обработать изображение"));
  }

  function payOrder() {
    setError("");
    const selected = catalog.filter((p) => (cart[p.id] || 0) > 0);
    if (!selected.length) {
      setError("Корзина пустая");
      return;
    }
    if (selected.some((p) => p.retailerId !== selected[0].retailerId)) {
      setError("В заказе должны быть товары одного ритейлера");
      return;
    }
    if (!buyerRetailer) {
      setError("Выбери ритейлера");
      return;
    }
    if (!currentBuyer) {
      setError("Выбери покупателя");
      return;
    }
    const lastPaymentAt = buyerLastPaymentAt[buyerId] || 0;
    if (now - lastPaymentAt < ORDER_COOLDOWN_MS) {
      setError("Слишком частые оплаты. Подожди несколько секунд и повтори.");
      return;
    }
    if (isNewBuyer && total > NEW_ACCOUNT_MAX_ORDER_CENTS) {
      setError("Для нового аккаунта превышен лимит суммы одного заказа.");
      return;
    }
    if (isNewBuyer && orders24h.length >= NEW_ACCOUNT_MAX_ORDERS_PER_DAY) {
      setError("Для нового аккаунта достигнут лимит количества заказов за 24 часа.");
      return;
    }
    if (isNewBuyer && dailySpendCents + total > NEW_ACCOUNT_MAX_DAILY_CENTS) {
      setError("Для нового аккаунта превышен дневной лимит суммы заказов.");
      return;
    }
    if (pickupMonths < 1 || pickupMonths > 12) {
      setError("Срок забора должен быть от 1 до 12 месяцев");
      return;
    }
    if (!acceptedRules) {
      setError("Нужно принять правила ритейлера перед оплатой");
      return;
    }
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + pickupMonths);
    const nextOrder: Order = {
      id: `o-${Date.now()}`,
      buyerId,
      retailerId: selected[0].retailerId,
      pickupMonths,
      pickupDeadlineLabel: deadline.toLocaleDateString("ru-RU"),
      items: selected.map((p) => ({
        productId: p.id,
        title: p.title,
        qty: cart[p.id] || 0,
        subtotalCents: p.priceCents * (cart[p.id] || 0)
      })),
      totalCents: selected.reduce((s, p) => s + p.priceCents * (cart[p.id] || 0), 0),
      status: "paid",
      createdAt: now
    };
    setOrders((prev) => [nextOrder, ...prev]);
    setBuyerLastPaymentAt((prev) => ({ ...prev, [buyerId]: now }));
    setCart({});
    setAcceptedRules(false);
    setBuyerStep(1);
    setMessage("Оплата прошла успешно (sandbox).");
  }

  return (
    <main className="container vprok-page">
      <section className="card">
        <div className="vprok-hero-brand">
          <VprokLogo size={48} labeled wordmark />
        </div>
        <h1 className="page-title">Впрок — интерактивный sandbox</h1>
        <p className="vprok-main-slogan">Vprok: спокойствие в каждой покупке.</p>
        <p className="page-sub">
          Полноценный демо-режим: регистрация покупателя и ритейлера, правила ритейлера, публикация товаров,
          корзина и оплата.
          Бренды ритейлеров скрыты, используются обезличенные обозначения.
        </p>
        <div className="row">
          <button className={role === "buyer" ? "primary-btn" : "ghost-btn"} onClick={() => setRole("buyer")}>
            Режим покупателя
          </button>
          <button
            className={role === "retailer" ? "primary-btn" : "ghost-btn"}
            onClick={() => setRole("retailer")}
          >
            Режим ритейлера
          </button>
        </div>
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card vprok-ad-slot">
        <p className="vprok-ad-label">Рекламный блок</p>
        <div className="vprok-ad-box">
          <div>
            <strong>Ваш рекламный слот 970x250 / адаптив</strong>
            <p className="page-sub">
              Здесь можно подключить Яндекс РСЯ, Google AdSense или прямую рекламу партнера.
              Блок уже встроен в верстку и готов к интеграции скрипта.
            </p>
          </div>
        </div>
      </section>

      {role === "buyer" ? (
        <>
          <section className="card vprok-grid">
            <div>
              <h2 className="page-title page-title--sm">Регистрация покупателя</h2>
              <form className="grid" onSubmit={registerBuyer}>
                <input
                  placeholder="Имя"
                  value={buyerForm.name}
                  onChange={(e) => setBuyerForm((s) => ({ ...s, name: e.target.value }))}
                />
                <input
                  placeholder="Email"
                  value={buyerForm.email}
                  onChange={(e) => setBuyerForm((s) => ({ ...s, email: e.target.value }))}
                />
                <input
                  placeholder="Телефон (+79991234567)"
                  value={buyerForm.phone}
                  onChange={(e) => setBuyerForm((s) => ({ ...s, phone: e.target.value }))}
                />
                <input
                  placeholder="Пароль"
                  type="password"
                  value={buyerForm.password}
                  onChange={(e) => setBuyerForm((s) => ({ ...s, password: e.target.value }))}
                />
                <button className="primary-btn" type="submit">
                  Зарегистрироваться
                </button>
              </form>
            </div>
            <div>
              <h2 className="page-title page-title--sm">Войти как покупатель</h2>
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)}>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.email}, {b.phone})
                  </option>
                ))}
              </select>
              <div className="card" style={{ marginTop: 10 }}>
                <p className="page-sub">
                  <strong>Антифрод-статус:</strong> {isNewBuyer ? "Новый аккаунт (усиленные лимиты)" : "Стандартный"}
                </p>
                <p className="page-sub">
                  Лимиты новых аккаунтов: до {money(NEW_ACCOUNT_MAX_ORDER_CENTS)} за заказ, до{" "}
                  {money(NEW_ACCOUNT_MAX_DAILY_CENTS)} в сутки, до {NEW_ACCOUNT_MAX_ORDERS_PER_DAY} заказов/24ч.
                </p>
                <p className="page-sub">
                  Сейчас за 24ч: {orders24h.length} заказ(ов), {money(dailySpendCents)}.
                </p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 className="page-title page-title--sm">Покупательский wizard</h2>
              <button
                className="primary-btn"
                onClick={payOrder}
                disabled={buyerStep !== 4 || total <= 0}
              >
                Оплатить ({money(total)})
              </button>
            </div>
            <p className="page-sub">Шаг {buyerStep}/4</p>
            <div className="vprok-steps">
              <div className={`vprok-step ${buyerStep >= 1 ? "vprok-step--active" : ""}`}>
                <div>1. Ритейлер</div>
                <span className={`vprok-chip ${hasRetailerStep ? "vprok-chip--ok" : "vprok-chip--warn"}`}>
                  {hasRetailerStep ? "Готово" : "Выбери"}
                </span>
              </div>
              <div className={`vprok-step ${buyerStep >= 2 ? "vprok-step--active" : ""}`}>
                <div>2. Правила</div>
                <span className={`vprok-chip ${hasRulesStep ? "vprok-chip--ok" : "vprok-chip--warn"}`}>
                  {hasRulesStep ? "Принято" : "Подтверди"}
                </span>
              </div>
              <div className={`vprok-step ${buyerStep >= 3 ? "vprok-step--active" : ""}`}>
                <div>3. Срок</div>
                <span className={`vprok-chip ${hasPickupStep ? "vprok-chip--ok" : "vprok-chip--warn"}`}>
                  {hasPickupStep ? `${pickupMonths} мес.` : "Выбери"}
                </span>
              </div>
              <div className={`vprok-step ${buyerStep >= 4 ? "vprok-step--active" : ""}`}>
                <div>4. Товары</div>
                <span className={`vprok-chip ${hasProductsStep ? "vprok-chip--ok" : "vprok-chip--warn"}`}>
                  {hasProductsStep ? "Корзина готова" : "Добавь товар"}
                </span>
              </div>
            </div>
            <div className="grid vprok-step1-controls" style={{ marginBottom: 14 }}>
              <label className="field">
                <span className="field-label">Шаг 1: выбор ритейлера</span>
                <select
                  value={selectedRetailerForBuyer}
                  onChange={(e) => {
                    setSelectedRetailerForBuyer(e.target.value);
                    setCart({});
                    setAcceptedRules(false);
                    setBuyerStep(1);
                  }}
                >
                  {retailers.map((r, idx) => (
                    <option key={r.id} value={r.id}>
                      Ритейлер {idx + 1}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary-btn vprok-step1-next"
                type="button"
                onClick={() => setBuyerStep(2)}
                disabled={!buyerRetailer}
              >
                Продолжить к правилам
              </button>
            </div>
            {buyerRetailer && buyerStep >= 2 ? (
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 className="page-title page-title--sm">Шаг 2: правила ритейлера</h3>
                <p className="page-sub">
                  <strong>Общие условия:</strong> {buyerRetailer.workRules}
                </p>
                <p className="page-sub">
                  <strong>Замена и возврат:</strong> {buyerRetailer.substitutionRules}
                </p>
                <p className="page-sub">
                  <strong>Получение:</strong> {buyerRetailer.pickupRules}
                </p>
                <label className="row" style={{ alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={acceptedRules}
                    onChange={(e) => setAcceptedRules(e.target.checked)}
                    style={{ width: 20, minHeight: 20 }}
                  />
                  <span>Я принимаю правила ритейлера и срок забора товара</span>
                </label>
                <div className="row">
                  <button className="ghost-btn" type="button" onClick={() => setBuyerStep(1)}>
                    Назад
                  </button>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => setBuyerStep(3)}
                    disabled={!acceptedRules}
                  >
                    Продолжить к сроку забора
                  </button>
                </div>
              </div>
            ) : null}
            {buyerStep >= 3 ? (
              <div className="card" style={{ marginBottom: 14 }}>
                <h3 className="page-title page-title--sm">Шаг 3: срок забора</h3>
                <div className="row">
                  <label className="field" style={{ maxWidth: 240 }}>
                    <span className="field-label">Срок забора (месяцев)</span>
                    <select
                      value={pickupMonths}
                      onChange={(e) => setPickupMonths(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="row">
                  <button className="ghost-btn" type="button" onClick={() => setBuyerStep(2)}>
                    Назад
                  </button>
                  <button className="primary-btn" type="button" onClick={() => setBuyerStep(4)}>
                    Перейти к выбору товаров
                  </button>
                </div>
              </div>
            ) : null}
            {buyerStep >= 4 ? (
              <>
                <div className="card" style={{ marginBottom: 14 }}>
                  <h3 className="page-title page-title--sm">Шаг 4: товары и оплата</h3>
                  <p className="page-sub">
                    Выбранный срок забора: {pickupMonths} мес. Для завершения нажми кнопку "Оплатить".
                  </p>
                </div>
                <div className="cards-grid">
                  {catalog.map((p) => (
                    <article key={p.id} className="profile-card">
                      {p.imageUrl ? <img src={p.imageUrl} alt={p.title} loading="lazy" /> : null}
                      <div className="profile-body">
                        <h3>{p.title}</h3>
                        <p className="page-sub">
                          {p.retailerLabel} · {money(p.priceCents)} / {p.unit}
                        </p>
                        <div className="row">
                          <button className="ghost-btn" onClick={() => changeQty(p.id, -1)}>
                            -
                          </button>
                          <input readOnly value={cart[p.id] || 0} />
                          <button className="ghost-btn" onClick={() => changeQty(p.id, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          <section className="card">
            <h2 className="page-title page-title--sm">Мои заказы</h2>
            <div className="list">
              {orders
                .filter((o) => o.buyerId === buyerId)
                .map((o) => (
                  <div key={o.id} className="list-item card">
                    Заказ {o.id} · статус: {o.status} · сумма: {money(o.totalCents)} · забор через{" "}
                    {o.pickupMonths} мес. (до {o.pickupDeadlineLabel})
                  </div>
                ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="card vprok-grid">
            <div>
              <h2 className="page-title page-title--sm">Регистрация ритейлера</h2>
              <form className="grid" onSubmit={registerRetailer}>
                <input
                  placeholder="Юр. лицо / название партнера"
                  value={retailerForm.legalName}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, legalName: e.target.value }))}
                />
                <input
                  placeholder="Email"
                  value={retailerForm.email}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, email: e.target.value }))}
                />
                <input
                  placeholder="Пароль"
                  type="password"
                  value={retailerForm.password}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, password: e.target.value }))}
                />
                <input
                  placeholder="Email для споров"
                  value={retailerForm.disputeEmail}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, disputeEmail: e.target.value }))}
                />
                <textarea
                  placeholder="Общие условия работы (обязательно)"
                  value={retailerForm.workRules}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, workRules: e.target.value }))}
                />
                <textarea
                  placeholder="Правила замены/возврата (обязательно)"
                  value={retailerForm.substitutionRules}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, substitutionRules: e.target.value }))}
                />
                <textarea
                  placeholder="Правила получения товара (обязательно)"
                  value={retailerForm.pickupRules}
                  onChange={(e) => setRetailerForm((s) => ({ ...s, pickupRules: e.target.value }))}
                />
                <button className="primary-btn" type="submit">
                  Зарегистрировать ритейлера
                </button>
              </form>
            </div>
            <div>
              <h2 className="page-title page-title--sm">Войти как ритейлер</h2>
              <select value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
                {retailers.map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    Ритейлер {idx + 1} ({r.email})
                  </option>
                ))}
              </select>
              {currentRetailer ? (
                <div className="card" style={{ marginTop: 10 }}>
                  <p className="page-sub">
                    <strong>Условия:</strong> {currentRetailer.workRules}
                  </p>
                  <p className="page-sub">
                    <strong>Замена/возврат:</strong> {currentRetailer.substitutionRules}
                  </p>
                  <p className="page-sub">
                    <strong>Получение:</strong> {currentRetailer.pickupRules}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="card">
            <h2 className="page-title page-title--sm">Шаг 2/3: обязательные правила ритейлера</h2>
            <p className="page-sub">
              Пока этот шаг не завершен, публикация товаров недоступна.
              {onboardingRetailerId === retailerId ? " Сейчас идет онбординг нового ритейлера." : ""}
            </p>
            <form className="grid" onSubmit={saveRetailerRules}>
              <textarea
                placeholder="Общие условия работы (обязательно)"
                value={retailerForm.workRules}
                onChange={(e) => setRetailerForm((s) => ({ ...s, workRules: e.target.value }))}
              />
              <textarea
                placeholder="Правила замены/возврата (обязательно)"
                value={retailerForm.substitutionRules}
                onChange={(e) => setRetailerForm((s) => ({ ...s, substitutionRules: e.target.value }))}
              />
              <textarea
                placeholder="Правила получения товара (обязательно)"
                value={retailerForm.pickupRules}
                onChange={(e) => setRetailerForm((s) => ({ ...s, pickupRules: e.target.value }))}
              />
              <button className="primary-btn" type="submit">
                Сохранить правила (разблокировать публикацию)
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="page-title page-title--sm">Шаг 3/3: добавить товар</h2>
            {!rulesCompleted ? (
              <p className="error">Сначала заверши шаг 2/3 (правила ритейлера).</p>
            ) : null}
            <form className="grid" onSubmit={addProduct}>
              <input
                placeholder="Название товара"
                value={productForm.title}
                onChange={(e) => setProductForm((s) => ({ ...s, title: e.target.value }))}
                disabled={!rulesCompleted}
              />
              <input
                placeholder="Ссылка на фото товара (https://...)"
                value={productForm.imageUrl}
                onChange={(e) => setProductForm((s) => ({ ...s, imageUrl: e.target.value }))}
                disabled={!rulesCompleted}
              />
              <label className="field">
                <span className="field-label">Или загрузи фото файлом (sandbox)</span>
                <div className="row">
                  <label className="field" style={{ maxWidth: 180 }}>
                    <span className="field-label">Кроп</span>
                    <select
                      value={imageAspect}
                      onChange={(e) => setImageAspect(e.target.value as CropAspect)}
                      disabled={!rulesCompleted}
                    >
                      <option value="4:3">4:3 (рекоменд.)</option>
                      <option value="1:1">1:1 (квадрат)</option>
                    </select>
                  </label>
                </div>
                <div
                  className="upload-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDemoProductImageSelected(e.dataTransfer.files?.[0] || null);
                  }}
                >
                  Перетащи файл сюда или выбери ниже
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!rulesCompleted}
                  onChange={(e) => onDemoProductImageSelected(e.target.files?.[0] || null)}
                />
              </label>
              <div className="row">
                <input
                  placeholder="Ед.изм"
                  value={productForm.unit}
                  onChange={(e) => setProductForm((s) => ({ ...s, unit: e.target.value }))}
                  disabled={!rulesCompleted}
                />
                <input
                  placeholder="Цена (коп.)"
                  type="number"
                  value={productForm.priceCents}
                  onChange={(e) => setProductForm((s) => ({ ...s, priceCents: e.target.value }))}
                  disabled={!rulesCompleted}
                />
                <input
                  placeholder="Срок хранения (дней)"
                  type="number"
                  value={productForm.shelfDays}
                  onChange={(e) => setProductForm((s) => ({ ...s, shelfDays: e.target.value }))}
                  disabled={!rulesCompleted}
                />
              </div>
              <button className="primary-btn" type="submit" disabled={!rulesCompleted}>
                Опубликовать
              </button>
            </form>
          </section>
        </>
      )}
    </main>
  );
}

