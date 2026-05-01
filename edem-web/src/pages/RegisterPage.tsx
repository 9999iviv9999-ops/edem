import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CitySelect } from "../components/CitySelect";
import russianCities from "../data/russianCities.json";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const allRussianCities = russianCities as string[];
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    age: 22,
    gender: "male",
    city: "Москва"
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const extractCitiesFromGyms = (items: Array<{ city?: string }>) =>
      Array.from(new Set(items.map((g) => g.city).filter((city): city is string => Boolean(city)))).sort((a, b) =>
        a.localeCompare(b, "ru")
      );
    const mergeWithAllCities = (source: string[]) =>
      Array.from(new Set([...source, ...allRussianCities])).sort((a, b) => a.localeCompare(b, "ru"));

    const loadCities = async () => {
      try {
        const citiesRes = await api.get("/api/gyms/cities");
        const cities = Array.isArray(citiesRes.data) ? citiesRes.data : [];
        const mergedCities = mergeWithAllCities(cities);
        if (!active) return;
        setAvailableCities(mergedCities);
        if (mergedCities.length > 0) {
          setForm((s) => (mergedCities.includes(s.city) ? s : { ...s, city: mergedCities[0] }));
        }
      } catch {
        try {
          const allGymsRes = await api.get("/api/gyms");
          const fallbackCities = extractCitiesFromGyms(Array.isArray(allGymsRes.data) ? allGymsRes.data : []);
          const mergedCities = mergeWithAllCities(fallbackCities);
          if (!active) return;
          setAvailableCities(mergedCities);
          if (mergedCities.length > 0) {
            setForm((s) => (mergedCities.includes(s.city) ? s : { ...s, city: mergedCities[0] }));
          }
        } catch {
          if (!active) return;
          setAvailableCities(allRussianCities);
        }
      }
    };

    void loadCities();

    return () => {
      active = false;
    };
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const phoneDigits = form.phone.trim().replace(/\D+/g, "");
      const normalizedPhone = phoneDigits ? `+${phoneDigits}` : "";
      const emailFromPhone = `${normalizedPhone.replace(/\D+/g, "")}@phone.local`;
      const { data } = await api.post("/api/auth/register", {
        ...form,
        name: form.name.trim(),
        city: form.city.trim(),
        phone: normalizedPhone,
        email: emailFromPhone,
        age: Number(form.age)
      });
      setTokens(data.accessToken, data.refreshToken);
      navigate("/profile");
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; details?: Array<{ path?: Array<string | number>; message?: string }> } };
        message?: string;
      };
      const detailText =
        ax.response?.data?.details?.[0]?.message ||
        (Array.isArray(ax.response?.data?.details) && ax.response?.data?.details?.length
          ? `Проверь поля: ${ax.response?.data?.details?.map((d) => d.path?.join(".") || d.message).join(", ")}`
          : "");
      const msg =
        detailText ||
        ax.response?.data?.error ||
        ax.message ||
        "Не удалось зарегистрироваться";
      setError(String(msg));
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-brand-logo" src="/edem-logo-v2.png" alt="ЭДЕМ" />
        </div>
        <h1>Создать аккаунт</h1>
        <p className="auth-lede">
          Быстрая регистрация по номеру телефона.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <input
            placeholder="Имя"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
          <input
            placeholder="Телефон (+79991234567)"
            value={form.phone}
            onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="Возраст (18–80)"
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
          <select
            value={form.gender}
            onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
          >
            <option value="male">Мужчина</option>
            <option value="female">Женщина</option>
            <option value="other">Другое</option>
          </select>
          <CitySelect
            value={form.city}
            options={availableCities}
            onChange={(city) => setForm((s) => ({ ...s, city }))}
          />
          {error && <div className="error">{error}</div>}
          <button className="primary-btn">Создать аккаунт</button>
        </form>
        <Link to="/login">Уже есть аккаунт? Войти</Link>
      </div>
    </div>
  );
}
