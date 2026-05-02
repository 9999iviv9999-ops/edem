import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CitySelect } from "../components/CitySelect";
import { GymPicker } from "../components/GymPicker";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string; address?: string | null; chainName?: string | null };
type Profile = { id: string; name: string; age: number; description?: string; photos: string[] };

function normalizePhotoUrl(url?: string) {
  const value = (url || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return `${window.location.origin}${value}`;
  if (value.startsWith("uploads/")) return `${window.location.origin}/${value}`;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${window.location.origin}${parsed.pathname}`;
      }
    } catch {
      // Keep original URL if parse fails.
    }
  }
  const uploadMatch = value.match(/(\/uploads\/[^?#]+)/i);
  if (uploadMatch?.[1]) return `${window.location.origin}${uploadMatch[1]}`;
  return value;
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
        const allGymsRes = await api.get("/api/gyms");
        cities = extractCitiesFromGyms(allGymsRes.data as Gym[]);
      }
      setAvailableCities(cities);
      const nextCity = me.city || "Москва";
      const cityToUse = cities.includes(nextCity) ? nextCity : cities[0] || "Москва";
      if (cityToUse !== nextCity) await persistLocation(cityToUse);
      setCity(cityToUse);
      const gymsRes = await api.get("/api/gyms", { params: { city: cityToUse } });
      setGyms(gymsRes.data);
      const gymIds = new Set((gymsRes.data as Array<{ id: string }>).map((g) => g.id));
      const main = memberships.find((m) => m.isPrimary)?.gymId;
      if (main && gymIds.has(main)) {
        setHasPrimaryGym(true);
        setGymId(main);
        await loadProfiles(main);
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

  async function loadProfiles(selectedGymId: string) {
    const { data } = await api.get(`/api/profiles/gyms/${selectedGymId}`);
    setProfiles(data);
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
    } finally {
      snoozeProfile(targetUserId);
      setMessage("Жалоба отправлена, анкета скрыта");
    }
  }

  function snoozeProfile(targetUserId: string) {
    const until = Date.now() + 48 * 60 * 60 * 1000;
    setSnoozedUntilByUserId((prev) => {
      const next = { ...prev, [targetUserId]: until };
      localStorage.setItem("edem_snoozed_profiles", JSON.stringify(next));
      return next;
    });
    setProfiles((s) => s.filter((p) => p.id !== targetUserId));
    setMessage("Анкета отложена на 48 часов");
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

  return (
    <div className="grid">
      <section className="card feed-hero">
        <div className="feed-hero-image-wrap">
          <img
            className="feed-hero-image"
            src="/edem-logo-v2.png"
            alt="ЭДЕМ — знакомства в зале"
            loading="eager"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </section>

      <div className="card">
        <h2 className="page-title">Лента</h2>
        <p className="page-sub">Выбери город и зал, смотри анкеты тех, кто тренируется рядом с тобой.</p>

        <div className="full feed-location">
          <h3 className="profile-section-title">Город</h3>
          <div className="grid">
            <div className="full">
              <CitySelect
                value={city}
                options={availableCities}
                showLabel={false}
                onChange={(c) => void onCityChange(c)}
              />
            </div>
          </div>
        </div>

        {!hasPrimaryGym ? (
          <div className="full feed-empty-gym">
            <p className="page-sub" style={{ marginBottom: 8 }}>
              Чтобы открыть ленту анкет, сначала выбери основной зал в профиле.
            </p>
            <Link className="primary-btn" to="/profile">
              Перейти в профиль и выбрать зал
            </Link>
          </div>
        ) : (
          <div className="full feed-controls">
          <GymPicker
            gyms={gyms}
            value={gymId}
            onChange={(id) => {
              setGymId(id);
              setProfiles([]);
            }}
          />
          <div className="row feed-actions">
            <button
              className="primary-btn"
              disabled={!gymId}
              onClick={() => void loadProfiles(gymId)}
            >
              Показать анкеты
            </button>
          </div>
          {!gymId && <p className="page-sub">Сначала выбери зал, затем нажми «Показать анкеты».</p>}
          </div>
        )}
        {errorMessage && <div className="error">{errorMessage}</div>}
        {message && <div className="success">{message}</div>}
      </div>

      {gymId && visibleProfiles.length === 0 && !errorMessage ? (
        <div className="card">
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Пока анкет в этом зале нет. Попробуй другой зал в этом же городе.
          </p>
        </div>
      ) : null}

      <div className="cards-grid">
        {visibleProfiles.map((p) => (
          <article className="profile-card" key={p.id}>
            <img
              src={normalizePhotoUrl(p.photos?.[0]) || "https://placehold.co/500x320?text=No+Photo"}
              alt={p.name}
            />
            <div className="profile-body">
              <h3>
                {p.name}, {p.age}
              </h3>
              <p>{p.description || "Люблю тренировки и активный образ жизни."}</p>
              <button className="primary-btn" onClick={() => like(p.id)}>
                Лайк
              </button>
              <button className="ghost-btn" onClick={() => openDirectChat(p.id)}>
                Написать
              </button>
              <button className="ghost-btn" onClick={() => snoozeProfile(p.id)}>
                Позже
              </button>
              <button className="ghost-btn" onClick={() => void navigate(`/profiles/${p.id}`)}>
                Смотреть анкету
              </button>
              <button className="ghost-btn" onClick={() => void blockUser(p.id)}>
                Заблокировать
              </button>
              <button className="ghost-btn" onClick={() => void reportAndHide(p.id)}>
                Пожаловаться + скрыть
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
