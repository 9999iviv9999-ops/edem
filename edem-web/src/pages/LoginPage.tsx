import axios from "axios";
import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";
import { normalizePhoneRu } from "../lib/phone";
import { useOAuthExchangeFromUrl } from "../lib/useOAuthExchangeFromUrl";

function isUnauthorized(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

function loginFailureMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const raw = (err.response?.data as { error?: string })?.error;
    if (typeof raw === "string" && raw.trim()) {
      const msg = raw.trim();
      if (msg === "Invalid credentials") return "Неверный номер или пароль";
      if (msg.includes("Too many auth attempts"))
        return "Слишком много попыток входа с этого адреса. Подождите несколько минут.";
      if (msg.includes("Too many login attempts for this account"))
        return "Слишком много попыток для этого номера. Попробуйте позже.";
      if (msg === "Account is banned") return "Аккаунт заблокирован.";
      return msg;
    }
    if (!err.response) return "Нет соединения с сервером. Проверьте интернет и попробуйте снова.";
    if (err.response.status >= 500) return "Сервер временно недоступен. Попробуйте через минуту.";
  }
  return "Не удалось войти. Попробуйте ещё раз.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const oauthError = useOAuthExchangeFromUrl("/");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const withPlus = normalizePhoneRu(phone);
    if (!withPlus || password.length < 6) {
      setError("Введи номер и пароль (не короче 6 символов)");
      return;
    }

    try {
      try {
        const { data } = await api.post("/api/auth/login", { phone: withPlus, password });
        setTokens(data.accessToken, data.refreshToken);
        navigate("/");
        return;
      } catch (firstErr) {
        if (!isUnauthorized(firstErr)) {
          setError(loginFailureMessage(firstErr));
          return;
        }
        const digits = withPlus.replace(/\D+/g, "");
        const { data } = await api.post("/api/auth/login", {
          email: `${digits}@phone.local`,
          password
        });
        setTokens(data.accessToken, data.refreshToken);
        navigate("/");
      }
    } catch (err) {
      setError(loginFailureMessage(err));
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
          {(error || oauthError) && <div className="error">{error || oauthError}</div>}
          <button className="primary-btn">Войти</button>
        </form>
        <Link to="/register">Нет аккаунта? Регистрация</Link>
      </div>
    </div>
  );
}
