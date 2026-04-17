import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { CropAspect, cropAndCompressImageFile, validateProductImage } from "../lib/imageUpload";

type Company = {
  id: string;
  name: string;
  slug: string;
  isVerified: boolean;
};

type CompanyMembership = {
  role: "owner" | "manager";
  company: Company;
};

type Product = {
  id: string;
  companyId: string;
  title: string;
  imageUrl?: string | null;
  unit: string;
  priceCents: number;
  minShelfLifeDays: number;
  company: Company;
};

type OrderItem = {
  id: string;
  productId: string;
  titleSnapshot: string;
  quantity: number;
  subtotalCents: number;
};

type Order = {
  id: string;
  companyId: string;
  status: string;
  totalCents: number;
  platformFeeBps?: number;
  platformFeeCents?: number;
  retailerPayoutCents?: number;
  createdAt: string;
  company: Company;
  items: OrderItem[];
};

type VprokPublicSettings = {
  platformFeeBps: number;
  platformFeePercent: number;
};

const money = (valueCents: number) => `${(valueCents / 100).toFixed(2)} ₽`;

export function VprokPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageAspect, setImageAspect] = useState<CropAspect>("4:3");

  const [companyForm, setCompanyForm] = useState({
    name: "",
    slug: "",
    disputeEmail: "",
    returnPolicyText: ""
  });
  const [productForm, setProductForm] = useState({
    companyId: "",
    title: "",
    imageUrl: "",
    unit: "шт",
    priceCents: "10000",
    minShelfLifeDays: "180"
  });

  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [feeSettings, setFeeSettings] = useState<VprokPublicSettings | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const totalCart = useMemo(
    () =>
      products.reduce((sum, p) => {
        const qty = cart[p.id] || 0;
        return sum + p.priceCents * qty;
      }, 0),
    [cart, products]
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [companiesRes, catalogRes, ordersRes] = await Promise.all([
        api.get<CompanyMembership[]>("/api/vprok/companies/my"),
        api.get<Product[]>("/api/vprok/catalog?limit=100"),
        api.get<Order[]>("/api/vprok/orders/my")
      ]);
      setMemberships(companiesRes.data);
      setProducts(catalogRes.data);
      setOrders(ordersRes.data);
      try {
        const { data } = await api.get<VprokPublicSettings>("/api/vprok/settings/public");
        setFeeSettings(data);
      } catch {
        setFeeSettings(null);
      }
      if (!productForm.companyId && companiesRes.data[0]?.company.id) {
        setProductForm((s) => ({ ...s, companyId: companiesRes.data[0].company.id }));
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post("/api/vprok/companies", {
        name: companyForm.name,
        slug: companyForm.slug,
        disputeEmail: companyForm.disputeEmail || undefined,
        returnPolicyText: companyForm.returnPolicyText || undefined
      });
      setMessage("Компания создана. Для публикации в каталоге нужна верификация модератором.");
      setCompanyForm({ name: "", slug: "", disputeEmail: "", returnPolicyText: "" });
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Ошибка создания компании");
    }
  }

  async function createProduct(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.post(`/api/vprok/companies/${productForm.companyId}/products`, {
        title: productForm.title,
        imageUrl: productForm.imageUrl || undefined,
        unit: productForm.unit,
        priceCents: Number(productForm.priceCents),
        minShelfLifeDays: Number(productForm.minShelfLifeDays)
      });
      setMessage("Товар добавлен.");
      setProductForm((s) => ({ ...s, title: "", imageUrl: "" }));
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Ошибка добавления товара");
    }
  }

  async function onProductImageSelected(file: File | null) {
    if (!file) return;
    setError("");
    setMessage("");
    const validationError = validateProductImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setUploadingImage(true);
    try {
      const compressed = await cropAndCompressImageFile(file, imageAspect);
      const ext = file.type === "image/png" ? "png" : "jpg";
      const form = new FormData();
      form.append("photo", compressed, `product.${ext}`);
      const { data } = await api.post<{ url: string }>("/api/media/upload-photo", form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setProductForm((s) => ({ ...s, imageUrl: data.url }));
      setMessage("Фото товара загружено.");
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось загрузить фото");
    } finally {
      setUploadingImage(false);
    }
  }

  function changeQty(productId: string, next: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, next) }));
  }

  async function checkout() {
    setMessage("");
    setError("");
    const selected = products
      .map((p) => ({ productId: p.id, quantity: cart[p.id] || 0, companyId: p.companyId }))
      .filter((x) => x.quantity > 0);
    if (!selected.length) {
      setError("Корзина пустая");
      return;
    }
    const companyId = selected[0].companyId;
    if (selected.some((x) => x.companyId !== companyId)) {
      setError("Для MVP заказ должен быть из одной компании");
      return;
    }
    try {
      const orderRes = await api.post<Order>("/api/vprok/orders", {
        companyId,
        acceptSellerTerms: true,
        acceptPlatformTerms: true,
        platformTermsVersion: "v1",
        sellerTermsVersion: "v1",
        items: selected.map((x) => ({ productId: x.productId, quantity: x.quantity }))
      });
      const payRes = await api.post<{
        settlement?: {
          grossCents: number;
          platformFeeCents: number;
          retailerPayoutCents: number;
        };
      }>(`/api/vprok/orders/${orderRes.data.id}/pay`, { provider: "mock-ui" });
      setCart({});
      const s = payRes.data.settlement;
      setMessage(
        s
          ? `Заказ оплачен (mock). Комиссия площадки ${money(s.platformFeeCents)}, ритейлеру ${money(s.retailerPayoutCents)}.`
          : "Заказ оплачен (mock)."
      );
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось оформить заказ");
    }
  }

  return (
    <div className="vprok-page">
      <section className="card">
        <h1 className="page-title">Впрок</h1>
        <p className="page-sub">
          Площадка предоплаты: ритейлеры публикуют товары, покупатель оплачивает онлайн и забирает позже.
        </p>
        {loading ? <p className="page-sub">Загрузка...</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card vprok-grid">
        <div>
          <h2 className="page-title page-title--sm">1) Добавить компанию</h2>
          <form className="grid" onSubmit={createCompany}>
            <input
              placeholder="Название"
              value={companyForm.name}
              onChange={(e) => setCompanyForm((s) => ({ ...s, name: e.target.value }))}
              required
            />
            <input
              placeholder="Slug (latin, lower, dash)"
              value={companyForm.slug}
              onChange={(e) => setCompanyForm((s) => ({ ...s, slug: e.target.value }))}
              required
            />
            <input
              placeholder="Email для споров"
              value={companyForm.disputeEmail}
              onChange={(e) => setCompanyForm((s) => ({ ...s, disputeEmail: e.target.value }))}
            />
            <textarea
              placeholder="Политика возврата"
              value={companyForm.returnPolicyText}
              onChange={(e) => setCompanyForm((s) => ({ ...s, returnPolicyText: e.target.value }))}
            />
            <button className="primary-btn" type="submit">
              Создать компанию
            </button>
          </form>
        </div>

        <div>
          <h2 className="page-title page-title--sm">2) Добавить товар</h2>
          <form className="grid" onSubmit={createProduct}>
            <select
              value={productForm.companyId}
              onChange={(e) => setProductForm((s) => ({ ...s, companyId: e.target.value }))}
              required
            >
              <option value="">Выбери компанию</option>
              {memberships.map((m) => (
                <option key={m.company.id} value={m.company.id}>
                  {m.company.name} ({m.company.isVerified ? "verified" : "not verified"})
                </option>
              ))}
            </select>
            <input
              placeholder="Название товара"
              value={productForm.title}
              onChange={(e) => setProductForm((s) => ({ ...s, title: e.target.value }))}
              required
            />
            <input
              placeholder="Ссылка на фото товара (https://...)"
              value={productForm.imageUrl}
              onChange={(e) => setProductForm((s) => ({ ...s, imageUrl: e.target.value }))}
            />
            <label className="field">
              <span className="field-label">Или загрузи фото файлом</span>
              <div className="row">
                <label className="field" style={{ maxWidth: 180 }}>
                  <span className="field-label">Кроп</span>
                  <select
                    value={imageAspect}
                    onChange={(e) => setImageAspect(e.target.value as CropAspect)}
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
                  onProductImageSelected(e.dataTransfer.files?.[0] || null);
                }}
              >
                Перетащи файл сюда или выбери ниже
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onProductImageSelected(e.target.files?.[0] || null)}
              />
            </label>
            {uploadingImage ? <p className="page-sub">Загрузка фото...</p> : null}
            <div className="row">
              <input
                placeholder="Ед. изм."
                value={productForm.unit}
                onChange={(e) => setProductForm((s) => ({ ...s, unit: e.target.value }))}
                required
              />
              <input
                placeholder="Цена в копейках"
                type="number"
                min={1}
                value={productForm.priceCents}
                onChange={(e) => setProductForm((s) => ({ ...s, priceCents: e.target.value }))}
                required
              />
              <input
                placeholder="Срок хранения (дней)"
                type="number"
                min={1}
                value={productForm.minShelfLifeDays}
                onChange={(e) =>
                  setProductForm((s) => ({ ...s, minShelfLifeDays: e.target.value }))
                }
                required
              />
            </div>
            <button className="primary-btn" type="submit">
              Добавить товар
            </button>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="page-title page-title--sm">3) Каталог и корзина</h2>
          <button className="ghost-btn" onClick={checkout}>
            Оплатить корзину ({money(totalCart)})
          </button>
        </div>
        {feeSettings && totalCart > 0 ? (
          <p className="page-sub">
            Комиссия площадки {feeSettings.platformFeePercent}% удерживается из оплаты; остаток уходит ритейлеру (после
            подключения эквайера — через split).
          </p>
        ) : null}
        <div className="cards-grid">
          {products.map((p) => (
            <article key={p.id} className="profile-card">
              {p.imageUrl ? <img src={p.imageUrl} alt={p.title} loading="lazy" /> : null}
              <div className="profile-body">
                <h3>{p.title}</h3>
                <p className="page-sub">
                  {p.company.name} · {money(p.priceCents)} / {p.unit}
                </p>
                <div className="row">
                  <button className="ghost-btn" onClick={() => changeQty(p.id, (cart[p.id] || 0) - 1)}>
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={cart[p.id] || 0}
                    onChange={(e) => changeQty(p.id, Number(e.target.value || 0))}
                  />
                  <button className="ghost-btn" onClick={() => changeQty(p.id, (cart[p.id] || 0) + 1)}>
                    +
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="page-title page-title--sm">4) Мои заказы</h2>
        <div className="list">
          {orders.map((o) => (
            <div key={o.id} className="list-item card">
              <strong>{o.company.name}</strong> · {o.status} · {money(o.totalCents)}
              {typeof o.platformFeeCents === "number" && typeof o.retailerPayoutCents === "number" ? (
                <span className="page-sub">
                  {" "}
                  · комиссия {money(o.platformFeeCents)}, ритейлеру {money(o.retailerPayoutCents)}
                </span>
              ) : null}
              <div className="chips">
                {o.items.map((it) => (
                  <span key={it.id} className="chip">
                    {it.titleSnapshot} x{it.quantity}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!orders.length ? <p className="page-sub">Пока заказов нет.</p> : null}
        </div>
      </section>
    </div>
  );
}

