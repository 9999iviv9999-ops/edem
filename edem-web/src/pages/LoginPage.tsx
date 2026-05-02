import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";
import { normalizePhoneRu } from "../lib/phone";

export function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Пароль не короче 6 символов");
      return;
    }
    const trimmed = identifier.trim();
    try {
      if (trimmed.includes("@")) {
        const email = trimmed.toLowerCase();
        const { data } = await api.post("/api/auth/login", { email, password });
        setTokens(data.accessToken, data.refreshToken);
        navigate("/");
        return;
      }
      const withPlus = normalizePhoneRu(trimmed);
      if (!withPlus) {
        setError("Введи номер телефона или email");
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
      setError("Неверный телефон, email или пароль");
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
          Вход по телефону или email и паролю.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <input
            placeholder="Телефон или email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
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
