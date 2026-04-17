import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VprokLogo } from "../components/VprokLogo";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/api/auth/login", { email, phone, password });
      setTokens(data.accessToken, data.refreshToken);
      navigate("/");
    } catch {
      setError("Неверный email, телефон или пароль");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <VprokLogo size={56} labeled wordmark />
        </div>
        <h1>Добро пожаловать в Vprok</h1>
        <p className="auth-lede">
          <strong>Vprok</strong> — платформа отложенных покупок. Войди, чтобы выбрать ритейлера,
          зафиксировать цену и оформить покупку впрок.
        </p>
        <form onSubmit={onSubmit} className="grid">
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input
            placeholder="Телефон (+79991234567)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div className="error">{error}</div>}
          <button className="primary-btn">Войти</button>
        </form>
        <Link to="/register">Нет аккаунта? Регистрация</Link>
      </div>
    </div>
  );
}
