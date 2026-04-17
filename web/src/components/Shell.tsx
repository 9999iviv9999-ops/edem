import { NavLink, useNavigate } from "react-router-dom";
import { VprokLogo } from "./VprokLogo";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { api } from "../lib/api";

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
          <div className="brand-wrap">
            <VprokLogo size={40} labeled wordmark className="brand-logo-mark" />
            <span className="brand-tagline">покупай заранее, забирай позже</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink className={navClass} to="/vprok">
            Впрок
          </NavLink>
          <NavLink className={navClass} to="/vprok-admin">
            Vprok Admin
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
