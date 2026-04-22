import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminAreaSelect } from "../components/AdminAreaSelect";
import { CitySelect } from "../components/CitySelect";
import { EdemLogo } from "../components/EdemLogo";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    age: 22,
    gender: "male",
    city: "Москва",
    okrug: "",
    district: ""
  });
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/api/auth/register", {
        ...form,
        age: Number(form.age)
      });
      setTokens(data.accessToken, data.refreshToken);
      navigate("/profile");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      const msg =
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
          <EdemLogo size={56} labeled />
        </div>
        <h1>Создать аккаунт</h1>
        <p className="auth-lede">
          Шаг в <strong>райский сад Edem</strong>: анкета привязана к твоему фитнес-центру — так проще
          встретиться вживую после совпадения.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <input
            placeholder="Имя"
            value={form.name}
            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
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
            onChange={(city) =>
              setForm((s) => ({
                ...s,
                city,
                okrug: "",
                district: ""
              }))
            }
          />
          <AdminAreaSelect
            city={form.city}
            okrug={form.okrug}
            district={form.district}
            onOkrugChange={(okrug) => setForm((s) => ({ ...s, okrug }))}
            onDistrictChange={(district) => setForm((s) => ({ ...s, district }))}
          />
          {error && <div className="error">{error}</div>}
          <button className="primary-btn">Создать аккаунт</button>
        </form>
        <Link to="/login">Уже есть аккаунт? Войти</Link>
      </div>
    </div>
  );
}
