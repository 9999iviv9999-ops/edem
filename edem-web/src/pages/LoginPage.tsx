import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";
import { normalizePhoneRu } from "../lib/phone";

export function LoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const withPlus = normalizePhoneRu(phone);
      if (!withPlus || password.length < 6) {
        setError("Введи номер и пароль (не короче 6 символов)");
        return;
      }
      try {
        const { data } = await api.post("/api/auth/login", { phone: withPlus, password });
        setTokens(data.accessToken, data.refreshToken);
        navigate("/");
        return;
      } catch {
        const digits = withPlus.replace(/\D+/g, "");
        const { data } = await api.post("/api/auth/login", {
          email: `${digits}@phone.local`,
          password
        });
        setTokens(data.accessToken, data.refreshToken);
        navigate("/");
      }
    } catch {
      setError("Неверный номер или пароль");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img className="auth-brand-logo" src="/edem-logo-v2.png" alt="ЭДЕМ" />
        </div>
        <h1>Добро пожаловать в ЭДЕМ</h1>
        <p className="auth-lede">
          Вход по номеру телефона. Укажи номер и пароль.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <input
            placeholder="Телефон (+79991234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <div className="error">{error}</div>}
          <button className="primary-btn">Войти</button>
        </form>
        <Link to="/register">Нет аккаунта? Регистрация</Link>
      </div>
    </div>
  );
}
