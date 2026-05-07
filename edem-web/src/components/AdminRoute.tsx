import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";

type Props = {
  children: JSX.Element;
};

export function AdminRoute({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(() => localStorage.getItem("edem_is_admin") === "1");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data } = await api.get("/api/profiles/me");
        if (!active) return;
        const nextAllowed = Boolean(data?.isAdmin);
        setAllowed(nextAllowed);
        localStorage.setItem("edem_is_admin", nextAllowed ? "1" : "0");
      } catch {
        if (!active) return;
        // Keep previously known role on transient API/auth hiccups.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="card">Проверка доступа...</div>;
  }
  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return children;
}
