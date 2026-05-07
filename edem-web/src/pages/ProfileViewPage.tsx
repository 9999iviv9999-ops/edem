import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Comment = {
  id: string;
  text: string;
  createdAt: string;
  photoIndex?: number | null;
  author: { id: string; name: string; photos: string[] };
};

type ProfilePayload = {
  profile: {
    id: string;
    name: string;
    age: number;
    city: string;
    description?: string;
    photos: string[];
    profileBadge?: string | null;
    inGym?: boolean;
    inGymAt?: string | null;
    inGymMinutes?: number;
    memberships: Array<{ isPrimary: boolean; gym: { id: string; name: string; city: string } }>;
  };
  comments: Comment[];
};

function normalizePhotoUrl(url: string) {
  const value = url.trim();
  if (!value) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  if (value.startsWith("uploads/")) return `${window.location.origin}/${value}`;
  if (value.startsWith("/")) return `${window.location.origin}${value}`;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/uploads/")) {
        return `${window.location.origin}${parsed.pathname}`;
      }
    } catch {
      // Keep original URL if parse fails.
    }
  }
  const uploadMatch = value.match(/(\/uploads\/[^?#]+)/i);
  if (uploadMatch?.[1]) return `${window.location.origin}${uploadMatch[1]}`;
  return value;
}

export function ProfileViewPage() {
  const { userId = "" } = useParams();
  const [myUserId, setMyUserId] = useState("");
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activePhoto, setActivePhoto] = useState(0);
  const [commentTarget, setCommentTarget] = useState<"profile" | "photo">("profile");

  const photos = useMemo(
    () => (data?.profile.photos?.length ? data.profile.photos : ["https://placehold.co/900x1200?text=No+Photo"]),
    [data]
  );
  const visibleComments = useMemo(() => {
    const all = data?.comments || [];
    if (commentTarget === "profile") {
      return all.filter((c) => c.photoIndex === null || c.photoIndex === undefined);
    }
    return all.filter((c) => c.photoIndex === activePhoto);
  }, [data?.comments, commentTarget, activePhoto]);
  const primaryGym = data?.profile.memberships.find((m) => m.isPrimary)?.gym;

  useEffect(() => {
    if (!userId) return;
    void load();
  }, [userId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [payloadRes, meRes] = await Promise.all([
        api.get(`/api/profiles/${userId}`),
        api.get("/api/profiles/me")
      ]);
      const payload = payloadRes.data;
      setData(payload);
      setMyUserId(String(meRes.data?.id || ""));
      setActivePhoto(0);
      setCommentTarget("profile");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось открыть анкету");
    } finally {
      setLoading(false);
    }
  }

  async function deleteMyComment(commentId: string) {
    try {
      await api.delete(`/api/profiles/comments/${commentId}`);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось удалить комментарий");
    }
  }

  async function postComment(e: FormEvent) {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !userId) return;
    try {
      await api.post(`/api/profiles/${userId}/comments`, {
        text,
        photoIndex: commentTarget === "photo" ? activePhoto : null
      });
      setCommentText("");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось отправить комментарий");
    }
  }

  async function reportComment(commentId: string) {
    try {
      await api.post(`/api/profiles/comments/${commentId}/report`);
      setError("");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось отправить жалобу");
    }
  }

  return (
    <div className="grid">
      <section className="card">
        <Link to="/" className="ghost-btn" style={{ width: "fit-content" }}>
          Назад в ленту
        </Link>
        {loading ? <p className="page-sub">Загружаем анкету...</p> : null}
        {error ? <div className="error">{error}</div> : null}
        {data ? (
          <div className="grid">
            <div className="profile-view-photo">
              <img
                className="profile-view-photo-main"
                src={normalizePhotoUrl(photos[activePhoto])}
                alt={`${data.profile.name} фото ${activePhoto + 1}`}
              />
              <div className="profile-view-photo-controls">
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => setActivePhoto((p) => (p <= 0 ? photos.length - 1 : p - 1))}
                  disabled={photos.length < 2}
                >
                  Назад
                </button>
                <span className="page-sub" style={{ margin: 0 }}>
                  {activePhoto + 1} / {photos.length}
                </span>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => setActivePhoto((p) => (p + 1) % photos.length)}
                  disabled={photos.length < 2}
                >
                  Вперед
                </button>
              </div>
            </div>
            <div>
              <h2 className="page-title">
                {data.profile.name}, {data.profile.age}
              </h2>
              {data.profile.profileBadge?.trim() ? (
                <span className="profile-badge-chip">{data.profile.profileBadge.trim()}</span>
              ) : null}
              {data.profile.inGym ? (
                <span className="in-gym-chip in-gym-chip--active">
                  {data.profile.inGymMinutes ? `В зале ${data.profile.inGymMinutes} мин` : "Сейчас в зале"}
                </span>
              ) : null}
              <p className="page-sub">
                {data.profile.city}
                {primaryGym ? ` · ${primaryGym.name}` : ""}
              </p>
              <p>{data.profile.description || "Пользователь пока не добавил описание."}</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h3 className="page-title page-title--sm">
          {commentTarget === "photo" ? `Комментарии к фото ${activePhoto + 1}` : "Комментарии к анкете"}
        </h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <button
            type="button"
            className={`ghost-btn ${commentTarget === "profile" ? "nav-link--active" : ""}`}
            onClick={() => setCommentTarget("profile")}
          >
            К профилю
          </button>
          <button
            type="button"
            className={`ghost-btn ${commentTarget === "photo" ? "nav-link--active" : ""}`}
            onClick={() => setCommentTarget("photo")}
          >
            К фото {activePhoto + 1}
          </button>
        </div>
        <form onSubmit={postComment} className="grid">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={commentTarget === "photo" ? `Комментарий к фото ${activePhoto + 1}...` : "Оставить комментарий к профилю..."}
            maxLength={400}
          />
          <button className="primary-btn" type="submit" disabled={!commentText.trim()}>
            Опубликовать
          </button>
        </form>
        <div className="list">
          {visibleComments.map((comment) => (
            <div key={comment.id} className="list-item">
              <div className="chat-list-head">
                <span className="chat-list-name">{comment.author.name}</span>
                <span className="chat-list-sub">
                  {new Date(comment.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
                {comment.text}
              </span>
              <button className="ghost-btn" type="button" onClick={() => void deleteMyComment(comment.id)}>
                Удалить комментарий
              </button>
            </div>
          ))}
          {!visibleComments.length ? <p className="page-sub">Пока комментариев нет.</p> : null}
        </div>
      </section>
    </div>
  );
}

