import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string };

export function ProfilePage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [form, setForm] = useState({
    name: "",
    age: 22,
    gender: "male",
    city: "Москва",
    description: "",
    photos: [] as string[],
    mainGymId: "",
    extraGymIds: [] as string[],
    goals: ["communication"],
    trainingTimeSlots: ["evening"],
    trainingTypes: ["strength"]
  });
  const [photoInput, setPhotoInput] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [gymsRes, meRes] = await Promise.all([
      api.get("/api/gyms"),
      api.get("/api/profiles/me")
    ]);
    setGyms(gymsRes.data);

    const me = meRes.data;
    const main = me.memberships.find((m: any) => m.isPrimary)?.gymId || "";
    const extra = me.memberships.filter((m: any) => !m.isPrimary).map((m: any) => m.gymId);

    setForm({
      name: me.name || "",
      age: me.age || 22,
      gender: me.gender || "male",
      city: me.city || "Москва",
      description: me.description || "",
      photos: me.photos || [],
      mainGymId: main,
      extraGymIds: extra,
      goals: me.goals.map((x: any) => x.goal),
      trainingTimeSlots: me.trainingSlots.map((x: any) => x.slot),
      trainingTypes: me.trainingTypes.map((x: any) => x.type)
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    await api.put("/api/profiles/me", form);
    setMessage("Профиль сохранен");
  }

  return (
    <div className="card profile-page">
      <div className="profile-page-glow" aria-hidden />
      <div className="profile-page-inner">
        <h2 className="page-title">Мой сад</h2>
        <p className="page-sub">
          Расскажи о себе и привяжи зал — так Edem покажет тебе подходящих людей в твоём «райском уголке»
          фитнеса.
        </p>
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
              <label className="field">
                <span className="field-label">Город</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                  placeholder="Где живёшь"
                  autoComplete="address-level2"
                />
              </label>
            </div>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">История</h3>
            <label className="field full">
              <span className="field-label">О себе</span>
              <textarea
                placeholder="Чем занимаешься, что ищешь в Edem — пару строк о тебе"
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
              />
            </label>
          </div>

          <div className="profile-section full">
            <h3 className="profile-section-title">Твой зал</h3>
            <label className="field full">
              <span className="field-label">Основной фитнес-центр</span>
              <select
                value={form.mainGymId}
                onChange={(e) => setForm((s) => ({ ...s, mainGymId: e.target.value }))}
              >
                <option value="">Выбери основной зал</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>
                    {gym.name} ({gym.city})
                  </option>
                ))}
              </select>
            </label>
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
                placeholder="URL фото"
                value={photoInput}
                onChange={(e) => setPhotoInput(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  if (!photoInput) return;
                  setForm((s) => ({ ...s, photos: [...s.photos, photoInput] }));
                  setPhotoInput("");
                }}
              >
                Добавить фото
              </button>
            </div>
            <div className="full chips">
              {form.photos.map((url) => (
                <span key={url} className="chip">
                  {url.slice(0, 24)}...
                </span>
              ))}
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
