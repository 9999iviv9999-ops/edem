import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    age: 22,
    gender: "male",
    city: "Москва"
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
        <h1>Регистрация</h1>
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
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
          />
          <input
            type="number"
            min={18}
            max={80}
            value={form.age}
            onChange={(e) => setForm((s) => ({ ...s, age: Number(e.target.value) }))}
          />
          <select
            value={form.gender}
            onChange={(e) => setForm((s) => ({ ...s, gender: e.target.value }))}
          >
            <option value="male">Мужчина</option>
            <option value="female">Женщина</option>
            <option value="other">Другое</option>
          </select>
          <input
            placeholder="Город"
            value={form.city}
            onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
          />
          {error && <div className="error">{error}</div>}
          <button className="primary-btn">Создать аккаунт</button>
        </form>
        <Link to="/login">Уже есть аккаунт? Войти</Link>
      </div>
    </div>
  );
}
