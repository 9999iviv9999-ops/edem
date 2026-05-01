import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export function CatalogImportPage() {
  const [city, setCity] = useState("Москва");
  const [okrug, setOkrug] = useState("");
  const [district, setDistrict] = useState("");
  const [region, setRegion] = useState("");
  const [chainName, setChainName] = useState("");
  const [replaceScope, setReplaceScope] = useState(false);
  const [rawList, setRawList] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    const lines = rawList
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!city.trim() || lines.length === 0) {
      setError("Нужны город и список строк");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/api/moderation/catalog/import-list", {
        city,
        okrug: okrug || undefined,
        district: district || undefined,
        region: region || undefined,
        chainName: chainName || undefined,
        replaceScope,
        lines
      });
      setMessage(
        `Готово: распознано ${data.parsed}, добавлено ${data.inserted}` +
          (data.deleted ? `, удалено в зоне ${data.deleted}` : "")
      );
    } catch (e: any) {
      setError(e?.response?.data?.error || "Ошибка импорта");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="page-title">Импорт каталога залов</h2>
      <p className="page-sub">
        Вставь список строк вида: Название — Адрес. Импорт идёт в выбранный город/округ/район. Доступ только у администраторов
        (проверка на сервере).
      </p>
      <form className="grid two-col" onSubmit={onSubmit}>
        <label className="field">
          <span className="field-label">Город</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Округ (опц.)</span>
          <input value={okrug} onChange={(e) => setOkrug(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Район (опц.)</span>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Регион (опц.)</span>
          <input value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Сеть/категория (опц.)</span>
          <input value={chainName} onChange={(e) => setChainName(e.target.value)} />
        </label>
        <label className="field full">
          <span className="field-label">Список (по 1 строке)</span>
          <textarea
            rows={12}
            value={rawList}
            onChange={(e) => setRawList(e.target.value)}
            placeholder={"Фитнес-клуб Пример — ул. Примерная, д. 1\nТренажерный зал Пример 2 — ул. Вторая, д. 5"}
          />
        </label>
        <label className="checkbox-row full">
          <input type="checkbox" checked={replaceScope} onChange={(e) => setReplaceScope(e.target.checked)} />
          <span>Сначала удалить текущие записи в этой зоне (город/округ/район)</span>
        </label>
        <div className="full">
          <button className="primary-btn" disabled={loading}>
            {loading ? "Импортируем..." : "Импортировать в каталог"}
          </button>
        </div>
      </form>
      {message && <div className="success">{message}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

