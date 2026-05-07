import { useMemo, useState } from "react";
import { apiUrl } from "./config";

type Campaign = {
  id: string;
  title: string;
  status: "draft" | "active" | "frozen";
  raisedRub: number;
  targetRub: number;
  payoutRecipientName: string;
  payoutMethod: "sbp_phone" | "phone" | "card";
  payoutTarget: string;
  complaintsCount: number;
};

type TransferConfirmation = {
  id: string;
  campaignId: string;
  amountRub: number;
  confirmedAt: string;
  ip: string;
  userAgent: string;
  receiptUrl?: string;
};
type PlacementPaymentStatus = "pending" | "processing" | "paid" | "failed";
type PlacementPayment = {
  id: string;
  ownerPhone: string;
  plan: "monthly" | "half_year" | "yearly";
  amountRub: number;
  status: PlacementPaymentStatus;
  paymentUrl: string;
  createdAt: string;
  updatedAt: string;
  operatorId?: string;
  externalRef?: string;
  statusReason?: string;
};
type Subscription = {
  id: string;
  ownerPhone: string;
  plan: "monthly" | "half_year" | "yearly";
  status: "active" | "inactive";
  periodStart: string;
  periodEnd: string;
};

const storageKey = "skinulis_admin_key";
const roleStorageKey = "skinulis_admin_role";
type AdminRole = "moderator" | "ops" | "superadmin";

export function AdminApp() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [adminRole, setAdminRole] = useState<AdminRole>(() => (localStorage.getItem(roleStorageKey) as AdminRole) ?? "superadmin");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<TransferConfirmation[]>([]);
  const [placementPayments, setPlacementPayments] = useState<PlacementPayment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [message, setMessage] = useState("");

  const totals = useMemo(() => {
    const totalRaised = campaigns.reduce((acc, item) => acc + item.raisedRub, 0);
    return { totalRaised, campaigns: campaigns.length, logs: logs.length, placement: placementPayments.length, subscriptions: subscriptions.length };
  }, [campaigns, logs, placementPayments, subscriptions]);

  async function loadAdminData() {
    setMessage("");
    const normalizedAdminKey = adminKey.trim();
    if (!normalizedAdminKey) {
      setMessage("Введите admin key");
      return;
    }
    setAdminKey(normalizedAdminKey);
    localStorage.setItem(storageKey, normalizedAdminKey);
    localStorage.setItem(roleStorageKey, adminRole);

    const adminHeaders = { "x-admin-key": normalizedAdminKey, "x-admin-role": adminRole };
    const authCheckRes = await fetch(`${apiUrl}/v1/admin/auth-check`, { headers: adminHeaders });
    if (!authCheckRes.ok) {
      if (authCheckRes.status === 401) {
        setMessage(`Доступ запрещен: проверьте пару роль (${adminRole}) + admin key`);
        return;
      }
      if (authCheckRes.status === 400) {
        setMessage("Некорректная роль админа");
        return;
      }
      setMessage("API недоступен или временно не отвечает");
      return;
    }

    const campaignPromise =
      adminRole === "ops" ? Promise.resolve(null) : fetch(`${apiUrl}/v1/admin/campaigns`, { headers: adminHeaders });
    const logsPromise =
      adminRole === "moderator"
        ? Promise.resolve(null)
        : fetch(`${apiUrl}/v1/admin/transfer-confirmations`, { headers: adminHeaders });
    const placementPromise =
      adminRole === "moderator" ? Promise.resolve(null) : fetch(`${apiUrl}/v1/admin/placement-payments`, { headers: adminHeaders });
    const subsPromise =
      adminRole === "moderator" ? Promise.resolve(null) : fetch(`${apiUrl}/v1/admin/subscriptions`, { headers: adminHeaders });
    const [campaignRes, logsRes, placementRes, subsRes] = await Promise.all([campaignPromise, logsPromise, placementPromise, subsPromise]);

    if ((campaignRes && !campaignRes.ok) || (logsRes && !logsRes.ok) || (placementRes && !placementRes.ok) || (subsRes && !subsRes.ok)) {
      setMessage("Ошибка загрузки данных админки после авторизации");
      return;
    }

    setCampaigns(campaignRes ? ((await campaignRes.json()) as Campaign[]) : []);
    setLogs(logsRes ? ((await logsRes.json()) as TransferConfirmation[]) : []);
    setPlacementPayments(placementRes ? ((await placementRes.json()) as PlacementPayment[]) : []);
    setSubscriptions(subsRes ? ((await subsRes.json()) as Subscription[]) : []);
    setMessage("Данные админки загружены");
  }

  async function enqueuePlacement(id: string) {
    const res = await fetch(`${apiUrl}/v1/admin/placement-payments/${id}/enqueue`, {
      method: "POST",
      headers: { "x-admin-key": adminKey, "x-admin-role": adminRole }
    });
    if (!res.ok) {
      setMessage("Не удалось взять платеж в обработку");
      return;
    }
    await loadAdminData();
  }

  async function completePlacement(id: string, status: "paid" | "failed") {
    const res = await fetch(`${apiUrl}/v1/admin/placement-payments/${id}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": adminKey,
        "x-admin-role": adminRole
      },
      body: JSON.stringify({
        status,
        operatorId: `web-${adminRole}`,
        statusReason: status === "failed" ? "Отклонено оператором" : undefined
      })
    });
    if (!res.ok) {
      setMessage("Не удалось завершить платеж");
      return;
    }
    await loadAdminData();
  }

  return (
    <div className="page shell">
      <header className="hero">
        <p className="eyebrow">Admin Console</p>
        <h1>Skinulis / Админка</h1>
        <p className="hero-copy">Управление сборами и журналом подтверждений переводов.</p>
      </header>

      <main className="card" style={{ marginTop: 16 }}>
        <h2>Вход по ключу</h2>
        <div className="form">
          <select value={adminRole} onChange={(e) => setAdminRole(e.target.value as AdminRole)}>
            <option value="moderator">moderator</option>
            <option value="ops">ops</option>
            <option value="superadmin">superadmin</option>
          </select>
          <input value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="Введите admin key" />
          <button onClick={loadAdminData}>Войти в админку</button>
        </div>
        <p className="legal-note">Важно: роль должна соответствовать ключу (moderator/ops/superadmin).</p>
        {message ? <p className="status-message">{message}</p> : null}
      </main>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Сводка</h2>
        <p>Сборов: {totals.campaigns}</p>
        <p>Подтверждений переводов: {totals.logs}</p>
        <p>Счетов подписки: {totals.placement}</p>
        <p>Активных подписок: {totals.subscriptions}</p>
        <p>Суммарно подтверждено: {totals.totalRaised} RUB</p>
      </section>

      {adminRole !== "ops" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Сборы</h2>
          {campaigns.length === 0 ? <p>Нет данных.</p> : null}
          {campaigns.map((item) => (
            <div key={item.id} className="transfer-log-item">
              <p>
                <strong>{item.title}</strong> ({item.status})
              </p>
              <p>
                {item.raisedRub} / {item.targetRub} RUB, жалоб: {item.complaintsCount}
              </p>
              <p>
                Получатель: {item.payoutRecipientName}, способ: {item.payoutMethod}
              </p>
              <p className="mono">Реквизиты: {item.payoutTarget}</p>
            </div>
          ))}
        </section>
      ) : null}

      {adminRole !== "moderator" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Счета подписки</h2>
          {placementPayments.length === 0 ? <p>Нет данных.</p> : null}
          {placementPayments.map((item) => (
            <div key={item.id} className="transfer-log-item">
              <p>
                <strong>{item.amountRub} RUB</strong> / {item.plan} / {item.status}
              </p>
              <p className="mono">Payment: {item.id}</p>
              <p className="mono">Owner: {item.ownerPhone}</p>
              <p>
                Создан: {new Date(item.createdAt).toLocaleString("ru-RU")} | Обновлен:{" "}
                {new Date(item.updatedAt).toLocaleString("ru-RU")}
              </p>
              {item.statusReason ? <p>Причина: {item.statusReason}</p> : null}
              <div className="actions">
                {item.status === "pending" ? (
                  <button className="chip-btn" onClick={() => enqueuePlacement(item.id)}>
                    Взять в обработку
                  </button>
                ) : null}
                {item.status === "processing" || item.status === "pending" ? (
                  <>
                    <button className="chip-btn" onClick={() => completePlacement(item.id, "paid")}>
                      Подтвердить оплату
                    </button>
                    <button className="chip-btn" onClick={() => completePlacement(item.id, "failed")}>
                      Отклонить
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {adminRole !== "moderator" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Подписки</h2>
          {subscriptions.length === 0 ? <p>Нет данных.</p> : null}
          {subscriptions.map((item) => (
            <div key={item.id} className="transfer-log-item">
              <p>
                <strong>{item.ownerPhone}</strong> / {item.plan} / {item.status}
              </p>
              <p>
                Старт: {new Date(item.periodStart).toLocaleString("ru-RU")} | Окончание:{" "}
                {new Date(item.periodEnd).toLocaleString("ru-RU")}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {adminRole !== "moderator" ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Журнал переводов</h2>
          {logs.length === 0 ? <p>Нет данных.</p> : null}
          {logs.map((item) => (
            <div key={item.id} className="transfer-log-item">
              <p>
                <strong>{item.amountRub} RUB</strong> / {new Date(item.confirmedAt).toLocaleString("ru-RU")}
              </p>
              <p className="mono">Campaign: {item.campaignId}</p>
              <p className="mono">IP: {item.ip}</p>
              <p className="mono">UA: {item.userAgent}</p>
              {item.receiptUrl ? (
                <p>
                  Чек:{" "}
                  <a href={`${apiUrl}${item.receiptUrl}`} target="_blank" rel="noreferrer">
                    открыть
                  </a>
                </p>
              ) : (
                <p>Чек не загружен</p>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

