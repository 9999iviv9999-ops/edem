import { Link, useNavigate } from "react-router-dom";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { api } from "../lib/api";

type Props = {
  children: React.ReactNode;
};

export function Shell({ children }: Props) {
  const navigate = useNavigate();

  async function onLogout() {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post("/api/auth/logout", { refreshToken });
      }
    } catch {
      // no-op
    } finally {
      clearTokens();
      navigate("/login");
    }
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">EDEM</div>
        <nav className="nav">
          <Link to="/">Лента</Link>
          <Link to="/matches">Матчи</Link>
          <Link to="/profile">Профиль</Link>
        </nav>
        <button className="ghost-btn" onClick={onLogout}>
          Выйти
        </button>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
