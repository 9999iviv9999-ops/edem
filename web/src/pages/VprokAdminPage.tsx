import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Company = {
  id: string;
  name: string;
  slug: string;
  isVerified: boolean;
  isActive: boolean;
  createdAt: string;
};

type RiskSummary = {
  windowDays: number;
  totalEvents: number;
  byCode: Array<{ code: string; count: number }>;
  byScope: Array<{ scope: string; count: number }>;
  topUsers: Array<{ userId: string; email: string; name: string; count: number; lastEventAt: string }>;
};

const MOD_KEY_LS = "vprok_moderation_key";

export function VprokAdminPage() {
  const [key, setKey] = useState<string>(() => localStorage.getItem(MOD_KEY_LS) || "");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    if (!key) {
      setError("Укажи x-moderation-key");
      return;
    }
    setLoading(true);
    setError("");
    setMessage("");
    localStorage.setItem(MOD_KEY_LS, key);
    try {
      const headers = { "x-moderation-key": key };
      const [companiesRes, summaryRes] = await Promise.all([
        api.get<Company[]>("/api/vprok/admin/companies?status=all&limit=100", { headers }),
        api.get<RiskSummary>("/api/vprok/admin/risk-events/summary?days=7&top=10", { headers })
      ]);
      setCompanies(companiesRes.data);
      setSummary(summaryRes.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось загрузить админ-данные");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (key) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleVerify(company: Company, nextVerified: boolean) {
    setError("");
    setMessage("");
    try {
      await api.patch(
        `/api/vprok/admin/companies/${company.id}/verify`,
        { isVerified: nextVerified },
        { headers: { "x-moderation-key": key } }
      );
      setMessage(`Компания ${company.name}: isVerified=${String(nextVerified)}`);
      await loadData();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось изменить статус верификации");
    }
  }

  return (
    <div className="vprok-page">
      <section className="card">
        <h1 className="page-title">Vprok Admin</h1>
        <p className="page-sub">Верификация ритейлеров и risk-monitoring.</p>
        <div className="row">
          <input
            placeholder="x-moderation-key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
          />
          <button className="primary-btn" onClick={loadData}>
            Обновить
          </button>
        </div>
        {loading ? <p className="page-sub">Загрузка...</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="card">
        <h2 className="page-title page-title--sm">Ритейлеры</h2>
        <div className="list">
          {companies.map((c) => (
            <div key={c.id} className="list-item card">
              <strong>{c.name}</strong> ({c.slug}) · verified: {String(c.isVerified)} · active:{" "}
              {String(c.isActive)}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="ghost-btn" onClick={() => toggleVerify(c, true)}>
                  Верифицировать
                </button>
                <button className="ghost-btn" onClick={() => toggleVerify(c, false)}>
                  Снять верификацию
                </button>
              </div>
            </div>
          ))}
          {!companies.length ? <p className="page-sub">Нет компаний или нет доступа.</p> : null}
        </div>
      </section>

      <section className="card">
        <h2 className="page-title page-title--sm">Risk Summary (7d)</h2>
        {!summary ? (
          <p className="page-sub">Нет данных.</p>
        ) : (
          <>
            <p className="page-sub">Всего risk events: {summary.totalEvents}</p>
            <div className="vprok-grid">
              <div className="card">
                <h3 className="page-title page-title--sm">By code</h3>
                <div className="chips">
                  {summary.byCode.map((x) => (
                    <span key={x.code} className="chip">
                      {x.code}: {x.count}
                    </span>
                  ))}
                </div>
              </div>
              <div className="card">
                <h3 className="page-title page-title--sm">Top users</h3>
                <div className="list">
                  {summary.topUsers.map((u) => (
                    <div key={u.userId} className="list-item">
                      {u.email} · events: {u.count}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

