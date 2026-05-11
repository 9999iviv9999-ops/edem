import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Trainer = {
  id: string;
  name: string;
  age: number;
  city: string;
  photos: string[];
  trainerHeadline?: string | null;
  trainerBio?: string | null;
  trainerExperienceYears?: number | null;
  trainerSpecializations?: string[];
  trainerFormats?: string[];
  trainerPriceFrom?: number | null;
  trainerContacts?: string | null;
};

function photoUrl(url?: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function TrainersPage() {
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [list, setList] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.get("/api/profiles/me");
        setCity((me.data?.city as string) || "");
      } catch {
        setCity("");
      }
      try {
        const c = await api.get("/api/gyms/cities");
        setCities(Array.isArray(c.data) ? c.data : []);
      } catch {
        setCities([]);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/api/trainers", {
          params: { city: city || undefined, q: q.trim() || undefined, limit: 100 }
        });
        if (!active) return;
        setList(Array.isArray(data) ? data : []);
      } catch (e: unknown) {
        if (!active) return;
        const ax = e as { response?: { data?: { error?: string } } };
        setError(ax.response?.data?.error || "Не удалось загрузить тренеров");
        setList([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [city, q]);

  const title = useMemo(() => (city ? `Тренеры: ${city}` : "Тренеры"), [city]);

  return (
    <div className="card">
      <h2 className="page-title">{title}</h2>
      <p className="page-sub">Найди тренера по городу и сразу напиши ему в ЭДЕМ.</p>
      <div className="grid two-col">
        <label className="field">
          <span className="field-label">Город</span>
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Все города</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Поиск</span>
          <input
            placeholder="Имя, специализация, оффер"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {error ? <div className="error">{error}</div> : null}
      {loading ? <p className="page-sub">Загрузка...</p> : null}
      <div className="cards-grid">
        {list.map((t) => (
          <div className="profile-card" key={t.id}>
            {t.photos?.[0] ? <img src={photoUrl(t.photos[0])} alt={t.name} /> : null}
            <div className="profile-body">
              <h3>
                {t.name}, {t.age}
              </h3>
              <p className="page-sub">{t.trainerHeadline || "Тренер в EDEM"}</p>
              <p className="chip">{(t.trainerExperienceYears ?? 0) > 0 ? `Стаж: ${t.trainerExperienceYears} лет` : "Стаж не указан"}</p>
              {t.trainerPriceFrom ? <p className="chip">Цена от: {t.trainerPriceFrom} ₽</p> : null}
              {t.trainerSpecializations?.length ? (
                <p className="page-sub">{t.trainerSpecializations.join(" · ")}</p>
              ) : null}
              {t.trainerContacts ? <p className="page-sub">{t.trainerContacts}</p> : null}
              <Link className="primary-btn" to={`/profiles/${t.id}`}>
                Открыть профиль
              </Link>
            </div>
          </div>
        ))}
      </div>
      {!loading && !error && list.length === 0 ? (
        <p className="page-sub">Пока тренеров нет. Попроси знакомого тренера включить режим "Я тренер".</p>
      ) : null}
    </div>
  );
}

