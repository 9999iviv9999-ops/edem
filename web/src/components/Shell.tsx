import { NavLink, useNavigate } from "react-router-dom";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { api } from "../lib/api";
import { EdemLogo } from "./EdemLogo";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

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
        <div className="brand-lockup">
          <EdemLogo size={40} className="brand-logo" />
          <div className="brand-wrap">
            <div className="brand">Edem</div>
            <span className="brand-tagline">райский сад знакомств</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink className={navClass} end to="/">
            Лента
          </NavLink>
          <NavLink className={navClass} to="/matches">
            Матчи
          </NavLink>
          <NavLink className={navClass} to="/profile">
            Профиль
          </NavLink>
        </nav>
        <button className="ghost-btn" onClick={onLogout}>
          Выйти
        </button>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}
