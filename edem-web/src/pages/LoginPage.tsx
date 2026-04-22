import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EdemLogo } from "../components/EdemLogo";
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
      setError("Неверные email/телефон/пароль");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <EdemLogo size={56} labeled />
        </div>
        <h1>Добро пожаловать в Edem</h1>
        <p className="auth-lede">
          <strong>Эдем</strong> — образ райского сада: спокойное место, где знакомства начинаются с общего
          зала и схожих ценностей. Войди, чтобы найти своих людей рядом с тобой в зале.
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
