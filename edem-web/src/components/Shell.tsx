import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { api } from "../lib/api";

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

type Props = {
  children: React.ReactNode;
};

function BottomNavIcon({ name }: { name: "feed" | "likes" | "messages" | "profile" | "trainers" | "admin" }) {
  const paths: Record<string, string> = {
    feed: "M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    likes: "M12 21s-7.2-4.3-9.4-8.6C.7 8.8 2.1 5 5.8 5c2 0 3.2 1 4.2 2.4C11 6 12.2 5 14.2 5 17.9 5 19.3 8.8 21.4 12.4 19.2 16.7 12 21 12 21z",
    messages: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    profile: "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.5 0-8 2.3-8 5.2V21h16v-1.8C20 16.3 16.5 14 12 14z",
    trainers: "M4 20h16v-1.6c0-2.6-2.2-4.7-5-4.7h-6c-2.8 0-5 2.1-5 4.7zM9 8.5A3 3 0 1 0 9 2.5a3 3 0 0 0 0 6zm6 2.5 2.2-2.2L19 10.6l-2.2 2.2L14.6 10.6l-1.8 1.8 2.2 2.2-2.2 2.2 1.8 1.8 2.2-2.2 2.2 2.2 1.8-1.8z",
    admin: "M12 7a5 5 0 1 1-5 5 5 5 0 0 1 5-5zm0-4 1.2 2.4 2.6.3-1.8 1.9.4 2.7L12 9.2 9.6 10.3l.4-2.7L8.2 5.7l2.6-.3z"
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
  /** Pathname без basename; trailing slash не должен снимать layout--messages. */
  const { pathname } = useLocation();
  const isMessagesRoute = (pathname.replace(/\/+$/, "") || "/") === "/messages";
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
        // Keep previously known role on transient API/auth hiccups.
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
      localStorage.removeItem("edem_is_admin");
      navigate("/login");
    }
  }

  return (
    <div className={`layout${isMessagesRoute ? " layout--messages" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <img className="brand-hero-logo" src="/edem-logo-v2.png" alt="ЭДЕМ" />
          <div className="brand-wrap">
            <div className="brand">ЭДЕМ</div>
          </div>
        </div>
        <nav className="nav">
          <NavLink className={navClass} end to="/">
            Лента
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
        <button className="ghost-btn" onClick={onLogout}>
          Выйти
        </button>
      </div>
      <nav className="bottom-nav" aria-label="Мобильная навигация">
        <NavLink className={navClass} end to="/">
          <BottomNavIcon name="feed" />
          <span className="bottom-nav-label">Лента</span>
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
        <NavLink className={navClass} to="/trainers">
          <BottomNavIcon name="trainers" />
          <span className="bottom-nav-label">Тренеры</span>
        </NavLink>
        {isAdmin ? (
          <NavLink className={navClass} to="/admin">
            <BottomNavIcon name="admin" />
            <span className="bottom-nav-label">Админ</span>
          </NavLink>
        ) : null}
      </nav>
    </div>
  );
}
