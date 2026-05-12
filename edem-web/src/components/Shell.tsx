import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { api } from "../lib/api";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

type Props = {
  children: React.ReactNode;
};

function BottomNavIcon({ name }: { name: "feed" | "search" | "likes" | "messages" | "profile" }) {
  const paths: Record<string, string> = {
    feed: "M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    search:
      "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 4 11.99 4 9.5S7.01 5 9.5 5 15 7.01 15 9.5 12.99 14 9.5 14z",
    likes: "M12 21s-7.2-4.3-9.4-8.6C.7 8.8 2.1 5 5.8 5c2 0 3.2 1 4.2 2.4C11 6 12.2 5 14.2 5 17.9 5 19.3 8.8 21.4 12.4 19.2 16.7 12 21 12 21z",
    messages: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    profile: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.5 0-8 2.3-8 5.2V21h16v-1.8C20 16.3 16.5 14 12 14z"
  };
  return (
    <span aria-hidden className="bottom-nav-icon-svg-wrap">
      <svg className="bottom-nav-icon-svg" viewBox="0 0 24 24">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}

export function Shell({ children }: Props) {
  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDetailsElement>(null);
  const { pathname } = useLocation();
  const pathNorm = pathname.replace(/\/+$/, "") || "/";
  const isMessagesRoute = pathNorm === "/messages";
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("edem_is_admin") === "1");
  const [messagesUnread, setMessagesUnread] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await api.get("/api/profiles/me");
        if (!active) return;
        const nextIsAdmin = Boolean(data?.isAdmin);
        setIsAdmin(nextIsAdmin);
        localStorage.setItem("edem_is_admin", nextIsAdmin ? "1" : "0");
      } catch {
        if (!active) return;
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadUnread = async () => {
      try {
        const { data } = await api.get("/api/matches");
        if (!active) return;
        const sum = Array.isArray(data)
          ? data.reduce((acc: number, item: { unreadCount?: number }) => acc + (item.unreadCount ?? 0), 0)
          : 0;
        setMessagesUnread(sum);
      } catch {
        if (!active) return;
      }
    };
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 8000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const unreadBadge = useMemo(
    () => (messagesUnread > 0 ? <span className="nav-badge">{messagesUnread > 99 ? "99+" : messagesUnread}</span> : null),
    [messagesUnread]
  );

  function closeDrawer() {
    if (drawerRef.current) drawerRef.current.open = false;
  }

  async function onLogout() {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post("/api/auth/logout", { refreshToken });
      }
    } catch {
      // no-op
    } finally {
      closeDrawer();
      clearTokens();
      localStorage.removeItem("edem_is_admin");
      navigate("/login");
    }
  }

  return (
    <>
      <div className={`layout${isMessagesRoute ? " layout--messages" : ""}`}>
        <header className="topbar">
          <div className="brand-lockup">
            <img className="brand-hero-logo" src="/edem-logo-v2.png" alt="ЭДЕМ" />
            <div className="brand-wrap">
              <div className="brand">ЭДЕМ</div>
            </div>
          </div>
          <details ref={drawerRef} className="topbar-drawer">
            <summary className="topbar-drawer-btn" aria-label="Меню">
              <span className="topbar-drawer-icon" aria-hidden>
                ☰
              </span>
            </summary>
            <div className="topbar-drawer-panel">
              <NavLink className="topbar-drawer-link" to="/trainers" onClick={closeDrawer}>
                Тренеры
              </NavLink>
              {isAdmin ? (
                <NavLink className="topbar-drawer-link" to="/catalog-import" onClick={closeDrawer}>
                  Каталог
                </NavLink>
              ) : null}
              {isAdmin ? (
                <NavLink className="topbar-drawer-link" to="/admin" onClick={closeDrawer}>
                  Админка
                </NavLink>
              ) : null}
              <div className="topbar-drawer-divider" role="presentation" />
              <a className="topbar-drawer-link" href="https://t.me/edem_press" target="_blank" rel="noreferrer">
                Telegram
              </a>
              <a className="topbar-drawer-link" href="https://vk.com/edem_press" target="_blank" rel="noreferrer">
                VK
              </a>
              <button type="button" className="topbar-drawer-logout ghost-btn" onClick={() => void onLogout()}>
                Выйти
              </button>
            </div>
          </details>
          <nav className="nav">
            <NavLink className={navClass} end to="/">
              Лента
            </NavLink>
            <NavLink className={navClass} to="/search">
              Поиск
            </NavLink>
            <NavLink className={navClass} to="/likes">
              Лайки
            </NavLink>
            <NavLink className={navClass} to="/messages">
              Сообщения
              {unreadBadge}
            </NavLink>
            <NavLink className={navClass} to="/profile">
              Профиль
            </NavLink>
            {isAdmin ? (
              <NavLink className={navClass} to="/catalog-import">
                Каталог
              </NavLink>
            ) : null}
            <NavLink className={navClass} to="/trainers">
              Тренеры
            </NavLink>
            {isAdmin ? (
              <NavLink className={navClass} to="/admin">
                Админка
              </NavLink>
            ) : null}
          </nav>
        </header>
        <main className="container">{children}</main>
        <div className="logout-bottom">
          <div className="project-links" aria-label="Страницы проекта">
            <a className="project-link-pill" href="https://t.me/edem_press" target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a className="project-link-pill" href="https://vk.com/edem_press" target="_blank" rel="noreferrer">
              VK
            </a>
          </div>
          <button className="ghost-btn" onClick={() => void onLogout()}>
            Выйти
          </button>
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        <NavLink className={navClass} end to="/">
          <BottomNavIcon name="feed" />
          <span className="bottom-nav-label">Лента</span>
        </NavLink>
        <NavLink className={navClass} to="/search">
          <BottomNavIcon name="search" />
          <span className="bottom-nav-label">Поиск</span>
        </NavLink>
        <NavLink className={navClass} to="/likes">
          <BottomNavIcon name="likes" />
          <span className="bottom-nav-label">Лайки</span>
        </NavLink>
        <NavLink className={navClass} to="/messages">
          <BottomNavIcon name="messages" />
          <span className="bottom-nav-label">Чаты</span>
          {unreadBadge}
        </NavLink>
        <NavLink className={navClass} to="/profile">
          <BottomNavIcon name="profile" />
          <span className="bottom-nav-label">Профиль</span>
        </NavLink>
      </nav>
    </>
  );
}
