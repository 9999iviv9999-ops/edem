import { FormEvent, useEffect, useState } from "react";
import { apiUrl } from "./config";

type Campaign = {
  id: string;
  ownerPhone: string;
  title: string;
  story: string;
  category: string;
  targetRub: number;
  raisedRub: number;
  status: "draft" | "active" | "frozen";
  videoUrls: string[];
  payoutMethod: "sbp_phone" | "phone" | "card";
  payoutTarget: string;
  payoutRecipientName: string;
  socialLinks?: {
    vk?: string;
    telegram?: string;
    website?: string;
  };
};
type CampaignListResponse = {
  items: Campaign[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  categories: string[];
};

type TransferConfirmation = {
  id: string;
  campaignId: string;
  amountRub: number;
  confirmedAt: string;
  donorConsent: true;
  ip: string;
  userAgent: string;
  receiptUrl?: string;
};
type PublicConfig = {
  subscriptionsEnabled: boolean;
  freeActiveCampaignLimit: number;
};

export function App() {
  const socialLinks = [
    { title: "VK", href: "https://vk.com/wall-24597594_118020", label: "Новости и обсуждения" },
    { title: "Telegram", href: "https://t.me/skinulis", label: "Оперативные обновления" },
    { title: "Pikabu", href: "https://pikabu.ru", label: "Посты и обратная связь" }
  ];

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [targetRub, setTargetRub] = useState(5000);
  const [category, setCategory] = useState("Срочные бытовые расходы");
  const [phone, setPhone] = useState("+79990000000");
  const [payoutMethod, setPayoutMethod] = useState<Campaign["payoutMethod"]>("sbp_phone");
  const [payoutTarget, setPayoutTarget] = useState("+79990000000");
  const [payoutRecipientName, setPayoutRecipientName] = useState("Иван Иванов");
  const [socialVk, setSocialVk] = useState("");
  const [socialTelegram, setSocialTelegram] = useState("");
  const [socialWebsite, setSocialWebsite] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [acceptRules, setAcceptRules] = useState(false);
  const [message, setMessage] = useState("");
  const [donorConsentByCampaign, setDonorConsentByCampaign] = useState<Record<string, boolean>>({});
  const [logsByCampaign, setLogsByCampaign] = useState<Record<string, TransferConfirmation[]>>({});
  const [openLogsByCampaign, setOpenLogsByCampaign] = useState<Record<string, boolean>>({});
  const [receiptFileByConfirmation, setReceiptFileByConfirmation] = useState<Record<string, File | null>>({});
  const [publicConfig, setPublicConfig] = useState<PublicConfig>({ subscriptionsEnabled: true, freeActiveCampaignLimit: 1 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "progress_asc" | "raised_desc" | "goal_asc">("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  const payoutMethodLabel: Record<Campaign["payoutMethod"], string> = {
    sbp_phone: "СБП по номеру телефона",
    phone: "Перевод по номеру телефона",
    card: "Перевод на карту"
  };

  async function fetchCampaigns(targetPage = page) {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("limit", "8");
    params.set("sort", sortMode);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (selectedCategoryFilter) params.set("category", selectedCategoryFilter);
    const res = await fetch(`${apiUrl}/v1/campaigns?${params.toString()}`);
    const data = (await res.json()) as CampaignListResponse;
    setCampaigns(data.items);
    setTotalPages(data.meta.totalPages);
    setTotalCampaigns(data.meta.total);
    setCategories(data.categories);
    setPage(data.meta.page);
  }

  useEffect(() => {
    Promise.all([
      fetchCampaigns(1),
      fetch(`${apiUrl}/v1/public-config`)
        .then((res) => (res.ok ? (res.json() as Promise<PublicConfig>) : null))
        .then((cfg) => {
          if (cfg) setPublicConfig(cfg);
        })
    ]).catch(() => setMessage("API недоступен"));
  }, []);

  useEffect(() => {
    fetchCampaigns(1).catch(() => setMessage("Не удалось обновить ленту сборов"));
  }, [searchQuery, selectedCategoryFilter, sortMode]);

  async function onCreateCampaign(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!acceptRules) {
      setMessage("Подтвердите согласие с правилами прямых переводов");
      return;
    }

    const createRes = await fetch(`${apiUrl}/v1/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerPhone: phone,
        title,
        story,
        category,
        targetRub,
        payoutMethod,
        payoutTarget,
        payoutRecipientName,
        socialLinks: {
          ...(socialVk.trim() ? { vk: socialVk.trim() } : {}),
          ...(socialTelegram.trim() ? { telegram: socialTelegram.trim() } : {}),
          ...(socialWebsite.trim() ? { website: socialWebsite.trim() } : {})
        }
      })
    });

    if (!createRes.ok) {
      const payload = (await createRes.json().catch(() => ({}))) as { error?: string };
      setMessage(payload.error ?? "Не удалось создать сбор");
      return;
    }

    const campaign = (await createRes.json()) as Campaign;

    if (videoFile) {
      const formData = new FormData();
      formData.append("video", videoFile);
      await fetch(`${apiUrl}/v1/campaigns/${campaign.id}/videos`, {
        method: "POST",
        body: formData
      });
    }
    setTitle("");
    setStory("");
    setVideoFile(null);
    setPayoutTarget("+79990000000");
    setPayoutRecipientName("Иван Иванов");
    setSocialVk("");
    setSocialTelegram("");
    setSocialWebsite("");
    setAcceptRules(false);
    setMessage("Сбор опубликован.");
    await fetchCampaigns(1);
  }

  async function donate(campaignId: string, amountRub: number) {
    if (!donorConsentByCampaign[campaignId]) {
      setMessage("Перед подтверждением перевода отметьте согласие в карточке сбора");
      return;
    }

    const res = await fetch(`${apiUrl}/v1/campaigns/${campaignId}/transfer-confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountRub, donorConsent: true })
    });
    if (!res.ok) {
      setMessage("Не удалось подтвердить перевод");
      return;
    }
    setDonorConsentByCampaign((prev) => ({ ...prev, [campaignId]: false }));
    setMessage("Перевод подтвержден и зафиксирован в журнале");
    await fetchCampaigns(page);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Реквизиты скопированы");
    } catch {
      setMessage("Не удалось скопировать реквизиты");
    }
  }

  async function toggleLogs(campaignId: string) {
    const shouldOpen = !openLogsByCampaign[campaignId];
    setOpenLogsByCampaign((prev) => ({ ...prev, [campaignId]: shouldOpen }));
    if (!shouldOpen || logsByCampaign[campaignId]) {
      return;
    }
    const res = await fetch(`${apiUrl}/v1/campaigns/${campaignId}/transfer-confirmations`);
    if (!res.ok) {
      setMessage("Не удалось загрузить журнал переводов");
      return;
    }
    const items = (await res.json()) as TransferConfirmation[];
    setLogsByCampaign((prev) => ({ ...prev, [campaignId]: items }));
  }

  async function uploadReceipt(campaignId: string, confirmationId: string) {
    const file = receiptFileByConfirmation[confirmationId];
    if (!file) {
      setMessage("Сначала выберите файл чека");
      return;
    }
    const formData = new FormData();
    formData.append("receipt", file);
    const res = await fetch(`${apiUrl}/v1/transfer-confirmations/${confirmationId}/receipt`, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      setMessage("Не удалось загрузить чек");
      return;
    }
    setReceiptFileByConfirmation((prev) => ({ ...prev, [confirmationId]: null }));
    setMessage("Чек загружен");

    const logsRes = await fetch(`${apiUrl}/v1/campaigns/${campaignId}/transfer-confirmations`);
    if (logsRes.ok) {
      const items = (await logsRes.json()) as TransferConfirmation[];
      setLogsByCampaign((prev) => ({ ...prev, [campaignId]: items }));
    }
  }

  return (
    <div className="page shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="hero">
        <p className="eyebrow">Премиальная платформа микропомощи</p>
        <h1>Skinulis</h1>
        <p className="hero-copy">Современная платформа прозрачных взносов 10-100 RUB.</p>
        <div className="hero-metrics">
          <div>
            <strong>{campaigns.length}</strong>
            <span>активных сборов</span>
          </div>
          <div>
            <strong>{publicConfig.freeActiveCampaignLimit}</strong>
            <span>лимит активных сборов</span>
          </div>
          <div>
            <strong>10-100 RUB</strong>
            <span>быстрая поддержка</span>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="card create-card">
          <h2>Новый сбор</h2>
          <div className="placement-hint">
            Лимит публикации в текущем режиме: {publicConfig.freeActiveCampaignLimit} активных сборов на номер телефона.
          </div>
          <form onSubmit={onCreateCampaign} className="form">
            <label className="field-label">
              Телефон
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." required />
            </label>
            <label className="field-label">
              Заголовок
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Лекарства на неделю"
                minLength={5}
                required
              />
            </label>
            <label className="field-label">
              Краткая история
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Опишите ситуацию и зачем нужны средства"
                minLength={20}
                required
              />
            </label>
            <label className="field-label">
              Категория
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Категория" required />
            </label>
            <label className="field-label">
              Цель сбора (RUB)
              <input
                type="number"
                value={targetRub}
                onChange={(e) => setTargetRub(Number(e.target.value))}
                min={100}
                required
              />
            </label>
            <label className="field-label">
              Способ получения
              <select value={payoutMethod} onChange={(e) => setPayoutMethod(e.target.value as Campaign["payoutMethod"])}>
                <option value="sbp_phone">СБП по номеру телефона</option>
                <option value="phone">Перевод по номеру телефона</option>
                <option value="card">Перевод на карту</option>
              </select>
            </label>
            <label className="field-label">
              Реквизиты для перевода
              <input
                value={payoutTarget}
                onChange={(e) => setPayoutTarget(e.target.value)}
                placeholder="+79990000000 или 2200123456789012"
                required
              />
            </label>
            <label className="field-label">
              Получатель
              <input
                value={payoutRecipientName}
                onChange={(e) => setPayoutRecipientName(e.target.value)}
                placeholder="ФИО получателя"
                required
              />
            </label>
            <label className="field-label">
              Ссылка VK (необязательно)
              <input
                value={socialVk}
                onChange={(e) => setSocialVk(e.target.value)}
                placeholder="https://vk.com/..."
              />
            </label>
            <label className="field-label">
              Ссылка Telegram (необязательно)
              <input
                value={socialTelegram}
                onChange={(e) => setSocialTelegram(e.target.value)}
                placeholder="https://t.me/..."
              />
            </label>
            <label className="field-label">
              Сайт/другая ссылка (необязательно)
              <input
                value={socialWebsite}
                onChange={(e) => setSocialWebsite(e.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="field-label">
              Видеоролик
              <label className="file-picker">
                <span>Выбрать файл</span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <small>{videoFile ? `Выбрано: ${videoFile.name}` : "Файл не выбран"}</small>
            </label>
            <label className="consent">
              <input type="checkbox" checked={acceptRules} onChange={(e) => setAcceptRules(e.target.checked)} />
              <span>
                Я подтверждаю, что реквизиты принадлежат мне и понимаю: перевод выполняется напрямую между людьми, платформа
                не является оператором перевода денежных средств.
              </span>
            </label>
            <button type="submit">Опубликовать сбор</button>
          </form>
          {message ? <p className="status-message">{message}</p> : null}
        </section>

        <section className="card feed-card">
          <h2>Витрина сборов</h2>
          <div className="form">
            <label className="field-label">
              Поиск
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по заголовку, описанию или категории"
              />
            </label>
            <label className="field-label">
              Категория
              <select value={selectedCategoryFilter} onChange={(e) => setSelectedCategoryFilter(e.target.value)}>
                <option value="">Все категории</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Сортировка
              <select value={sortMode} onChange={(e) => setSortMode(e.target.value as "newest" | "progress_asc" | "raised_desc" | "goal_asc")}>
                <option value="newest">Сначала новые</option>
                <option value="progress_asc">Сначала с наименьшим прогрессом</option>
                <option value="raised_desc">С наибольшей суммой сборов</option>
                <option value="goal_asc">С наименьшей целью сбора</option>
              </select>
            </label>
            <p className="status-message">Найдено сборов: {totalCampaigns}</p>
          </div>
          <div className="list">
            {campaigns.map((campaign, index) => (
              <article key={campaign.id} className="campaign" style={{ animationDelay: `${index * 80}ms` }}>
                <h3>{campaign.title}</h3>
                <p className="campaign-category">{campaign.category}</p>
                <p>{campaign.story}</p>
                {campaign.videoUrls.length > 0 ? (
                  <video controls className="campaign-video" src={`${apiUrl}${campaign.videoUrls[0]}`} />
                ) : null}
                <p className="campaign-sum">
                  <strong>{campaign.raisedRub}</strong> / {campaign.targetRub} RUB
                </p>
                <div className="requisites">
                  <p>
                    <strong>Получатель:</strong> {campaign.payoutRecipientName}
                  </p>
                  <p>
                    <strong>Способ:</strong> {payoutMethodLabel[campaign.payoutMethod]}
                  </p>
                  <p className="mono">
                    <strong>Реквизиты:</strong> {campaign.payoutTarget}
                  </p>
                  <button className="chip-btn" onClick={() => copyText(campaign.payoutTarget)}>
                    Скопировать реквизиты
                  </button>
                </div>
                {campaign.socialLinks &&
                (campaign.socialLinks.vk || campaign.socialLinks.telegram || campaign.socialLinks.website) ? (
                  <div className="social-links-inline">
                    <strong>Соцсети автора:</strong>
                    <div className="actions">
                      {campaign.socialLinks.vk ? (
                        <a className="chip-btn social-chip" href={campaign.socialLinks.vk} target="_blank" rel="noreferrer">
                          VK
                        </a>
                      ) : null}
                      {campaign.socialLinks.telegram ? (
                        <a className="chip-btn social-chip" href={campaign.socialLinks.telegram} target="_blank" rel="noreferrer">
                          Telegram
                        </a>
                      ) : null}
                      {campaign.socialLinks.website ? (
                        <a className="chip-btn social-chip" href={campaign.socialLinks.website} target="_blank" rel="noreferrer">
                          Сайт
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <p className="legal-note">
                  Важно: переводы выполняются напрямую на реквизиты автора. Платформа не принимает и не хранит деньги
                  пользователей.
                </p>
                <div className="progress-track" aria-label="Прогресс сбора">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, (campaign.raisedRub / campaign.targetRub) * 100)}%` }}
                  />
                </div>
                <div className="actions">
                  <label className="consent consent-inline">
                    <input
                      type="checkbox"
                      checked={Boolean(donorConsentByCampaign[campaign.id])}
                      onChange={(e) =>
                        setDonorConsentByCampaign((prev) => ({ ...prev, [campaign.id]: e.target.checked }))
                      }
                    />
                    <span>Подтверждаю, что перевожу деньги напрямую автору и проверил реквизиты.</span>
                  </label>
                  <button className="chip-btn" onClick={() => donate(campaign.id, 10)}>
                    Я перевел +10
                  </button>
                  <button className="chip-btn" onClick={() => donate(campaign.id, 30)}>
                    Я перевел +30
                  </button>
                  <button className="chip-btn" onClick={() => donate(campaign.id, 50)}>
                    Я перевел +50
                  </button>
                  <button className="chip-btn" onClick={() => donate(campaign.id, 100)}>
                    Я перевел +100
                  </button>
                  <button className="chip-btn" onClick={() => toggleLogs(campaign.id)}>
                    {openLogsByCampaign[campaign.id] ? "Скрыть журнал переводов" : "Показать журнал переводов"}
                  </button>
                </div>
                {openLogsByCampaign[campaign.id] ? (
                  <div className="transfer-log">
                    <h4>Журнал подтверждений</h4>
                    {(logsByCampaign[campaign.id] ?? []).length === 0 ? (
                      <p>Подтверждений пока нет.</p>
                    ) : (
                      (logsByCampaign[campaign.id] ?? []).map((item) => (
                        <div key={item.id} className="transfer-log-item">
                          <p>
                            <strong>Сумма:</strong> {item.amountRub} RUB
                          </p>
                          <p>
                            <strong>Время:</strong> {new Date(item.confirmedAt).toLocaleString("ru-RU")}
                          </p>
                          <p className="mono">
                            <strong>IP:</strong> {item.ip}
                          </p>
                          <p className="mono">
                            <strong>User-Agent:</strong> {item.userAgent}
                          </p>
                          {item.receiptUrl ? (
                            <div className="receipt-box">
                              <p>
                                <strong>Чек:</strong>{" "}
                                <a href={`${apiUrl}${item.receiptUrl}`} target="_blank" rel="noreferrer">
                                  открыть файл
                                </a>
                              </p>
                              {item.receiptUrl.toLowerCase().endsWith(".pdf") ? null : (
                                <img src={`${apiUrl}${item.receiptUrl}`} alt="Чек перевода" className="receipt-image" />
                              )}
                            </div>
                          ) : (
                            <div className="receipt-box">
                              <label className="file-picker">
                                <span>Выбрать чек</span>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,application/pdf"
                                  onChange={(e) =>
                                    setReceiptFileByConfirmation((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.files?.[0] ?? null
                                    }))
                                  }
                                />
                              </label>
                              <button className="chip-btn" onClick={() => uploadReceipt(campaign.id, item.id)}>
                                Загрузить чек
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </article>
            ))}
            {campaigns.length === 0 ? <p>Пока нет активных сборов.</p> : null}
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="chip-btn" disabled={page <= 1} onClick={() => fetchCampaigns(page - 1)}>
              Назад
            </button>
            <span>
              Страница {page} из {totalPages}
            </span>
            <button className="chip-btn" disabled={page >= totalPages} onClick={() => fetchCampaigns(page + 1)}>
              Вперед
            </button>
          </div>
        </section>
      </main>
      <section className="card social-card">
        <h2>Мы в соцсетях</h2>
        <div className="social-grid">
          {socialLinks.map((item) => (
            <a key={item.title} className="social-link" href={item.href} target="_blank" rel="noreferrer">
              <strong>{item.title}</strong>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

