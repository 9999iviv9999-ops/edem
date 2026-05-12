import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CitySelect } from "../components/CitySelect";
import { GymPicker } from "../components/GymPicker";
import { api } from "../lib/api";
import { normalizePhotoUrl } from "../lib/photoUrl";

type Gym = { id: string; name: string; city: string; address?: string | null; chainName?: string | null };
type Profile = {
  id: string;
  name: string;
  age: number;
  description?: string;
  photos: string[];
  profileBadge?: string | null;
};

function truncateText(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function FeedPage() {
  const navigate = useNavigate();
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [city, setCity] = useState("Москва");
  const [hasPrimaryGym, setHasPrimaryGym] = useState(true);
  const [snoozedUntilByUserId, setSnoozedUntilByUserId] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("edem_snoozed_profiles");
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const now = Date.now();
      const active = Object.fromEntries(
        Object.entries(parsed).filter(([, until]) => Number.isFinite(until) && until > now)
      );
      setSnoozedUntilByUserId(active);
      localStorage.setItem("edem_snoozed_profiles", JSON.stringify(active));
    } catch {
      setSnoozedUntilByUserId({});
    }
    void bootstrap();
  }, []);

  function extractCitiesFromGyms(items: Gym[]) {
    return Array.from(new Set(items.map((g) => g.city).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "ru")
    );
  }

  async function persistLocation(nextCity: string) {
    try {
      await api.patch("/api/profiles/me/location", {
        city: nextCity,
        okrug: "",
        district: ""
      });
      setErrorMessage("");
    } catch {
      setErrorMessage("Не удалось сохранить город — попробуйте ещё раз");
    }
  }

  async function onCityChange(nextCity: string) {
    if (!nextCity || nextCity === city) return;
    setMessage("");
    setErrorMessage("");
    const { data } = await api.get("/api/gyms", { params: { city: nextCity } });
    setGyms(data);
    setCity(nextCity);
    setGymId("");
    setProfiles([]);
    await persistLocation(nextCity);
  }

  async function bootstrap() {
    setErrorMessage("");
    try {
      const meRes = await api.get("/api/profiles/me");
      const me = meRes.data as {
        city?: string;
        memberships?: Array<{ isPrimary?: boolean; gymId?: string }>;
      };
      const memberships = Array.isArray(me.memberships) ? me.memberships : [];
      let cities: string[] = [];
      try {
        const citiesRes = await api.get("/api/gyms/cities");
        cities = Array.isArray(citiesRes.data) ? citiesRes.data : [];
      } catch {
        const allGymsRes = await api.get("/api/gyms", { params: { limit: 5000 } });
        cities = extractCitiesFromGyms(allGymsRes.data as Gym[]);
      }
      setAvailableCities(cities);
      const nextCity = me.city || "Москва";
      const cityToUse = cities.includes(nextCity) ? nextCity : cities[0] || "Москва";
      if (cityToUse !== nextCity) await persistLocation(cityToUse);
      setCity(cityToUse);
      const main = memberships.find((m) => m.isPrimary)?.gymId;
      const gymsRes = await api.get("/api/gyms", { params: { city: cityToUse } });
      const list = gymsRes.data as Gym[];
      setGyms(list);
      const gymIds = new Set(list.map((g) => g.id));
      if (main && gymIds.has(main)) {
        setHasPrimaryGym(true);
        setGymId(main);
      } else {
        setHasPrimaryGym(false);
        setGymId("");
        setProfiles([]);
      }
    } catch {
      setErrorMessage("Не удалось загрузить ленту. Проверь вход или попробуй позже.");
      setHasPrimaryGym(false);
      setGymId("");
      setProfiles([]);
    }
  }

  useEffect(() => {
    if (!hasPrimaryGym || !gymId) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setErrorMessage("");
        const { data } = await api.get(`/api/profiles/gyms/${gymId}`);
        if (!cancelled) setProfiles(data);
      } catch {
        if (!cancelled) setErrorMessage("Не удалось загрузить анкеты для этого зала.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gymId, hasPrimaryGym]);

  async function loadProfiles(selectedGymId: string) {
    try {
      setErrorMessage("");
      const { data } = await api.get(`/api/profiles/gyms/${selectedGymId}`);
      setProfiles(data);
      setMessage("");
    } catch {
      setErrorMessage("Не удалось обновить анкеты.");
    }
  }

  async function like(toUserId: string) {
    if (!gymId) return;
    const { data } = await api.post("/api/likes", { toUserId, gymId });
    setProfiles((s) => s.filter((p) => p.id !== toUserId));
    setMessage(data.match ? "Взаимный лайк! У вас матч." : "Лайк отправлен");
  }

  async function blockUser(targetUserId: string) {
    try {
      await api.post("/api/blocks", { blockedUserId: targetUserId });
      setProfiles((s) => s.filter((p) => p.id !== targetUserId));
      setMessage("Пользователь заблокирован");
      setErrorMessage("");
    } catch {
      setErrorMessage("Не удалось заблокировать пользователя");
    }
  }

  async function reportAndHide(targetUserId: string) {
    try {
      await api.post("/api/reports", {
        reportedUserId: targetUserId,
        reason: "suspicious_profile",
        details: "quick_report_from_feed"
      });
    } catch {
      // Keep flow usable even if report endpoint throttles.
    }
    snoozeProfile(targetUserId, "Жалоба отправлена, анкета скрыта");
  }

  function snoozeProfile(targetUserId: string, feedback?: string) {
    const until = Date.now() + 48 * 60 * 60 * 1000;
    setSnoozedUntilByUserId((prev) => {
      const next = { ...prev, [targetUserId]: until };
      localStorage.setItem("edem_snoozed_profiles", JSON.stringify(next));
      return next;
    });
    setProfiles((s) => s.filter((p) => p.id !== targetUserId));
    setMessage(feedback ?? "Анкета отложена на 48 часов");
    setErrorMessage("");
  }

  function openDirectChat(targetUserId: string) {
    if (!gymId) {
      setErrorMessage("Сначала выбери зал");
      return;
    }
    void navigate(`/messages?userId=${encodeURIComponent(targetUserId)}&gymId=${encodeURIComponent(gymId)}`);
  }

  const visibleProfiles = profiles.filter((p) => {
    const until = snoozedUntilByUserId[p.id];
    return !until || until <= Date.now();
  });

  const current = visibleProfiles[0];

  const gymLabel = useMemo(() => {
    if (!gymId) return "";
    const g = gyms.find((x) => x.id === gymId);
    return g ? g.name : "";
  }, [gymId, gyms]);

  const photoUrl = current
    ? normalizePhotoUrl(current.photos?.[0]) || "https://placehold.co/800x1000/e6e6e6/7a7a7a?text=Фото"
    : "";

  const bioText = current?.description?.trim() || "Люблю тренировки и активный образ жизни.";

  return (
    <div className="feed-page">
      <section className="card feed-toolbar">
        <div className="feed-toolbar-head">
          <h2 className="page-title feed-toolbar-title">Лента</h2>
          <p className="page-sub feed-toolbar-sub">Зал и город — анкеты людей рядом с тобой.</p>
        </div>

        <div className="feed-toolbar-location">
          <h3 className="feed-toolbar-label">Город</h3>
          <CitySelect value={city} options={availableCities} showLabel={false} onChange={(c) => void onCityChange(c)} />
        </div>

        {!hasPrimaryGym ? (
          <div className="feed-empty-gym">
            <p className="page-sub" style={{ marginBottom: 8 }}>
              Выбери основной зал в профиле, чтобы открыть ленту.
            </p>
            <Link className="primary-btn" to="/profile">
              Перейти в профиль
            </Link>
          </div>
        ) : (
          <div className="feed-toolbar-controls">
            <GymPicker gyms={gyms} value={gymId} onChange={setGymId} />
            <div className="row feed-actions">
              <button className="primary-btn" type="button" disabled={!gymId} onClick={() => void loadProfiles(gymId)}>
                Обновить анкеты
              </button>
            </div>
            {!gymId ? <p className="page-sub">Выбери зал.</p> : null}
          </div>
        )}

        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {message ? <div className="success">{message}</div> : null}
      </section>

      {hasPrimaryGym && gymId && !current && !errorMessage ? (
        <div className="card feed-empty-card">
          <p className="feed-empty-title">Поблизости пока никого нет</p>
          <p className="page-sub">Попробуй другой зал или зайди позже.</p>
        </div>
      ) : null}

      {current ? (
        <article className="feed-swipe-card" aria-label={`Анкета: ${current.name}`}>
          <div className="feed-swipe-media">
            <img className="feed-swipe-photo" src={photoUrl} alt="" loading="lazy" />

            <div className="feed-swipe-gradient" aria-hidden />

            <div className="feed-swipe-info">
              <div className="feed-swipe-name-row">
                <h2 className="feed-swipe-name">
                  {current.name}, {current.age}
                </h2>
                {current.profileBadge?.trim() ? (
                  <span className="feed-swipe-badge">{current.profileBadge.trim()}</span>
                ) : null}
              </div>
              {gymLabel ? <p className="feed-swipe-gym">{gymLabel}</p> : null}
              <p className="feed-swipe-bio">{truncateText(bioText, 160)}</p>
            </div>

            <div className="feed-swipe-actions">
              <button
                type="button"
                className="feed-action-circle feed-action-circle--skip"
                aria-label="Позже"
                onClick={() => snoozeProfile(current.id)}
              >
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    d="M6 6l12 12M18 6L6 18"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="feed-action-circle feed-action-circle--like"
                aria-label="Лайк"
                onClick={() => void like(current.id)}
              >
                <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="feed-action-circle feed-action-circle--chat"
                aria-label="Написать"
                onClick={() => openDirectChat(current.id)}
              >
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="feed-swipe-meta">
            <button type="button" className="feed-meta-link" onClick={() => void navigate(`/profiles/${current.id}`)}>
              Полный профиль
            </button>
            <span className="feed-meta-dot" aria-hidden>
              ·
            </span>
            <button type="button" className="feed-meta-link feed-meta-link--danger" onClick={() => void blockUser(current.id)}>
              Заблокировать
            </button>
            <span className="feed-meta-dot" aria-hidden>
              ·
            </span>
            <button type="button" className="feed-meta-link feed-meta-link--danger" onClick={() => void reportAndHide(current.id)}>
              Жалоба
            </button>
          </div>
        </article>
      ) : null}
    </div>
  );
}
