import { FormEvent, useEffect, useState } from "react";
import { CitySelect } from "../components/CitySelect";
import { GymPicker } from "../components/GymPicker";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string; address?: string | null; chainName?: string | null };

function normalizePhotoUrl(url: string) {
  const value = url.trim();
  if (!value) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }
  if (value.startsWith("uploads/")) {
    return `${window.location.origin}/${value}`;
  }
  if (value.startsWith("/")) {
    return `${window.location.origin}${value}`;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${window.location.origin}${parsed.pathname}`;
      }
    } catch {
      // Keep original URL if it cannot be parsed.
    }
  }
  const uploadMatch = value.match(/(\/uploads\/[^?#]+)/i);
  if (uploadMatch?.[1]) {
    return `${window.location.origin}${uploadMatch[1]}`;
  }
  return value;
}

export function ProfilePage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    age: 22,
    gender: "male",
    city: "Москва",
    okrug: "",
    district: "",
    description: "",
    photos: [] as string[],
    mainGymId: "",
    extraGymIds: [] as string[],
    goals: ["communication"],
    trainingTimeSlots: ["evening"],
    trainingTypes: ["strength"]
  });
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [snoozedCount, setSnoozedCount] = useState(0);

  const profileCompletion = (() => {
    let score = 0;
    if (form.name.trim().length >= 2) score += 20;
    if (form.age >= 18) score += 10;
    if (form.city.trim()) score += 10;
    if (form.mainGymId) score += 20;
    if (form.description.trim().length >= 20) score += 20;
    if (form.photos.length > 0) score += 20;
    return Math.min(100, score);
  })();

  useEffect(() => {
    void load();
    try {
      const raw = localStorage.getItem("edem_snoozed_profiles");
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      const now = Date.now();
      const activeCount = Object.values(parsed).filter((until) => Number.isFinite(until) && until > now).length;
      setSnoozedCount(activeCount);
    } catch {
      setSnoozedCount(0);
    }
  }, []);

  function extractCitiesFromGyms(items: Gym[]) {
    return Array.from(new Set(items.map((g) => g.city).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "ru")
    );
  }

  async function onCityChange(city: string) {
    if (!city || city === form.city) return;
    const { data } = await api.get("/api/gyms", { params: { city } });
    setGyms(data);
    setForm((s) => ({
      ...s,
      city,
      okrug: "",
      district: "",
      mainGymId: "",
      extraGymIds: []
    }));
  }

  async function load() {
    setMessage("");
    setLoadError("");
    try {
      const meRes = await api.get("/api/profiles/me");
      const me = meRes.data as {
        name?: string;
        age?: number;
        gender?: string;
        city?: string;
        description?: string | null;
        photos?: string[];
        memberships?: Array<{ isPrimary?: boolean; gymId?: string }>;
        goals?: Array<{ goal?: string }>;
        trainingSlots?: Array<{ slot?: string }>;
        trainingTypes?: Array<{ type?: string }>;
      };
      const memberships = Array.isArray(me.memberships) ? me.memberships : [];
      const goals = Array.isArray(me.goals) ? me.goals : [];
      const trainingSlots = Array.isArray(me.trainingSlots) ? me.trainingSlots : [];
      const trainingTypes = Array.isArray(me.trainingTypes) ? me.trainingTypes : [];

      let cities: string[] = [];
      try {
        const citiesRes = await api.get("/api/gyms/cities");
        cities = Array.isArray(citiesRes.data) ? citiesRes.data : [];
      } catch {
        const allGymsRes = await api.get("/api/gyms");
        cities = extractCitiesFromGyms(allGymsRes.data as Gym[]);
      }
      setAvailableCities(cities);
      const city = me.city || "Москва";
      const cityToUse = cities.includes(city) ? city : cities[0] || "Москва";
      const gymsRes = await api.get("/api/gyms", { params: { city: cityToUse } });
      setGyms(gymsRes.data);
      const gymIds = new Set((gymsRes.data as Array<{ id: string }>).map((g) => g.id));
      const mainRaw = memberships.find((m) => m.isPrimary)?.gymId || "";
      const main = mainRaw && gymIds.has(mainRaw) ? mainRaw : "";
      const extra = memberships
        .filter((m) => !m.isPrimary)
        .map((m) => m.gymId || "")
        .filter((id) => id && gymIds.has(id));

      setForm({
        name: me.name || "",
        age: me.age || 22,
        gender: (me.gender as "male" | "female" | "other") || "male",
        city: cityToUse,
        okrug: "",
        district: "",
        description: me.description || "",
        photos: (me.photos || []).map((photo: string) => normalizePhotoUrl(photo)),
        mainGymId: main,
        extraGymIds: extra,
        goals: goals.map((x) => x.goal).filter(Boolean).length
          ? (goals.map((x) => x.goal).filter(Boolean) as string[])
          : ["communication"],
        trainingTimeSlots: trainingSlots.map((x) => x.slot).filter(Boolean).length
          ? (trainingSlots.map((x) => x.slot).filter(Boolean) as string[])
          : ["evening"],
        trainingTypes: trainingTypes.map((x) => x.type).filter(Boolean).length
          ? (trainingTypes.map((x) => x.type).filter(Boolean) as string[])
          : ["strength"]
      });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      setLoadError(
        ax.response?.data?.error ||
          ax.message ||
          "Не удалось загрузить профиль. Проверь вход или обнови страницу."
      );
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const payload = {
        ...form,
        goals: form.goals.length ? form.goals : ["communication"],
        trainingTimeSlots: form.trainingTimeSlots.length ? form.trainingTimeSlots : ["evening"],
        trainingTypes: form.trainingTypes.length ? form.trainingTypes : ["strength"]
      };
      await api.put("/api/profiles/me", payload);
      setMessage("Профиль сохранен");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMessage(ax.response?.data?.error || "Не удалось сохранить профиль");
    }
  }

  async function onChangePassword() {
    setMessage("");
    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setMessage("Заполни текущий и новый пароль");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("Подтверждение пароля не совпадает");
      return;
    }
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage("Пароль обновлен. Войди снова с новым паролем.");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMessage(ax.response?.data?.error || "Не удалось изменить пароль");
    }
  }

  async function onUploadPhoto(file: File | null) {
    if (!file) return;
    setMessage("");
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const { data } = await api.post("/api/media/upload-photo", fd);
      if (data?.url) {
        setForm((s) => ({ ...s, photos: [...s.photos, normalizePhotoUrl(data.url)] }));
        setMessage("Фото загружено");
      } else {
        setMessage("Не удалось получить ссылку на фото");
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setMessage(ax.response?.data?.error || "Не удалось загрузить фото");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function makePrimaryPhoto(url: string) {
    setForm((s) => ({
      ...s,
      photos: [url, ...s.photos.filter((p) => p !== url)]
    }));
  }

  function removePhoto(url: string) {
    setForm((s) => ({
      ...s,
      photos: s.photos.filter((p) => p !== url)
    }));
  }

  function clearSnoozedProfiles() {
    localStorage.removeItem("edem_snoozed_profiles");
    setSnoozedCount(0);
    setMessage("Скрытые анкеты восстановлены");
  }

  return (
    <div className="card profile-page">
      <div className="profile-page-glow" aria-hidden />
      <div className="profile-page-inner">
        <h2 className="page-title">Мой профиль</h2>
        <p className="page-sub">
          Расскажи о себе и привяжи зал, чтобы ЭДЕМ показывал подходящих людей в твоем городе и клубе.
        </p>
        {loadError ? (
          <div className="error full" role="alert">
            {loadError}
          </div>
        ) : null}
        <div className="profile-progress">
          <div className="profile-progress-head">
            <span>Заполненность профиля</span>
            <strong>{profileCompletion}%</strong>
          </div>
          <div className="profile-progress-track">
            <span style={{ width: `${profileCompletion}%` }} />
          </div>
        </div>
        <form onSubmit={onSubmit} className="grid two-col profile-form">
          <div className="profile-section full">
            <h3 className="profile-section-title">О тебе</h3>
            <div className="grid two-col">
              <label className="field">
                <span className="field-label">Имя</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Как к тебе обращаться"
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span className="field-label">Возраст</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="18–80"
                  value={form.age === 0 ? "" : form.age}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setForm((s) => ({ ...s, age: 0 }));
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isNaN(n)) setForm((s) => ({ ...s, age: n }));
                  }}
                />
              </label>
              <label className="field">
                <span className="field-label">Пол</span>
                <select value={form.gender} onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}>
                  <option value="male">Мужчина</option>
                  <option value="female">Женщина</option>
                  <option value="other">Другое</option>
                </select>
              </label>
              <div className="full">
                <CitySelect value={form.city} options={availableCities} onChange={(c) => void onCityChange(c)} />
              </div>
            </div>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">История</h3>
            <label className="field full">
              <span className="field-label">О себе</span>
              <textarea
                placeholder="Чем занимаешься, что ищешь в ЭДЕМ — пару строк о тебе"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />
            </label>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">Твой зал</h3>
            <div className="field full">
              <GymPicker
                gyms={gyms}
                value={form.mainGymId}
                onChange={(mainGymId) => setForm((s) => ({ ...s, mainGymId }))}
              />
            </div>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">Предпочтения</h3>
            <div className="grid three-prefs">
              <label className="field">
                <span className="field-label">Цели</span>
                <select
                  multiple
                  className="multi"
                  value={form.goals}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      goals: Array.from(e.target.selectedOptions).map((o) => o.value)
                    }))
                  }
                >
                  <option value="relationship">Отношения</option>
                  <option value="communication">Общение</option>
                  <option value="workout_partner">Партнер по тренировкам</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Время тренировок</span>
                <select
                  multiple
                  className="multi"
                  value={form.trainingTimeSlots}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      trainingTimeSlots: Array.from(e.target.selectedOptions).map((o) => o.value)
                    }))
                  }
                >
                  <option value="morning">Утро</option>
                  <option value="day">День</option>
                  <option value="evening">Вечер</option>
                  <option value="weekends">Выходные</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Тип тренировок</span>
                <select
                  multiple
                  className="multi"
                  value={form.trainingTypes}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      trainingTypes: Array.from(e.target.selectedOptions).map((o) => o.value)
                    }))
                  }
                >
                  <option value="strength">Силовые</option>
                  <option value="cardio">Кардио</option>
                  <option value="crossfit">Кроссфит</option>
                  <option value="yoga">Йога</option>
                </select>
              </label>
            </div>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">Фото</h3>
            <div className="full row">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  void onUploadPhoto(file);
                  e.currentTarget.value = "";
                }}
              />
              <span>{uploadingPhoto ? "Загрузка..." : "Выбери фото на устройстве"}</span>
            </div>
            {form.photos.length > 0 ? (
              <div className="full photo-grid">
                {form.photos.map((url, index) => (
                  <div className="photo-card" key={url}>
                    <img
                      className="photo-card-image"
                      src={normalizePhotoUrl(url)}
                      alt={`Фото ${index + 1}`}
                      onError={(e) => {
                        const failedSrc = e.currentTarget.currentSrc || e.currentTarget.src;
                        const match = failedSrc.match(/(\/uploads\/[^?#]+)/i);
                        if (match?.[1]) {
                          e.currentTarget.src = `${window.location.origin}${match[1]}`;
                        }
                      }}
                    />
                    <div className="photo-card-actions">
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => makePrimaryPhoto(url)}
                        disabled={index === 0}
                      >
                        {index === 0 ? "Основное фото" : "Сделать основным"}
                      </button>
                      <button className="ghost-btn" type="button" onClick={() => removePhoto(url)}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">Безопасность</h3>
            <div className="grid two-col">
              <label className="field">
                <span className="field-label">Текущий пароль</span>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((s) => ({ ...s, currentPassword: e.target.value }))}
                />
              </label>
              <label className="field">
                <span className="field-label">Новый пароль</span>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((s) => ({ ...s, newPassword: e.target.value }))}
                />
              </label>
              <label className="field full">
                <span className="field-label">Подтверждение нового пароля</span>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                />
              </label>
              <div className="full">
                <button className="ghost-btn" type="button" onClick={() => void onChangePassword()}>
                  Сменить пароль
                </button>
              </div>
              <div className="full row" style={{ alignItems: "center" }}>
                <span className="page-sub" style={{ margin: 0 }}>
                  Скрытые анкеты: {snoozedCount}
                </span>
                <button className="ghost-btn" type="button" onClick={clearSnoozedProfiles}>
                  Вернуть скрытые анкеты
                </button>
              </div>
            </div>
          </div>

          {message && <div className="success full">{message}</div>}
          <button className="primary-btn full" type="submit">
            Сохранить профиль
          </button>
        </form>
      </div>
    </div>
  );
}
