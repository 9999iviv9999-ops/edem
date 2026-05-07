import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type IncomingLikeRow = {
  id: string;
  createdAt: string;
  fromUser: {
    id: string;
    name: string;
    age: number;
    photos: string[];
    profileBadge?: string | null;
  };
  gym: { id: string; name: string; city: string };
};

function normalizePhotoUrl(url?: string) {
  const value = (url || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return `${window.location.origin}${value}`;
  if (/^https?:\/\//i.test(value)) return value;
  return value;
}

export function LikesPage() {
  const [rows, setRows] = useState<IncomingLikeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setError("");
      try {
        const { data } = await api.get<IncomingLikeRow[]>("/api/likes/incoming");
        if (!active) return;
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setError("Не удалось загрузить лайки");
        setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card">
      <h1 className="page-title">Лайки</h1>
      <p className="page-sub">Кто лайкнул тебя в общих залах</p>

      {loading ? <p className="page-sub">Загрузка…</p> : null}
      {error ? (
        <p className="page-sub" style={{ color: "#e0a0a0" }}>
          {error}
        </p>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="page-sub">Пока никто не лайкнул. Загляни в ленту.</p>
      ) : null}

      <ul className="likes-list">
        {rows.map((row) => {
          const photo = normalizePhotoUrl(row.fromUser.photos?.[0]);
          return (
            <li key={row.id} className="likes-list-item">
              <Link to={`/profiles/${row.fromUser.id}`} className="likes-list-link">
                {photo ? (
                  <img src={photo} alt="" className="likes-list-avatar" />
                ) : (
                  <div className="likes-list-avatar likes-list-avatar--empty" aria-hidden>
                    ···
                  </div>
                )}
                <div className="likes-list-body">
                  <div className="likes-list-name-row">
                    <span className="likes-list-name">{row.fromUser.name}</span>
                    <span className="likes-list-age">{row.fromUser.age}</span>
                    {row.fromUser.profileBadge ? (
                      <span className="likes-list-badge">{row.fromUser.profileBadge}</span>
                    ) : null}
                  </div>
                  <div className="likes-list-gym muted">{row.gym.name}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
