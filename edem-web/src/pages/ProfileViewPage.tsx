import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePhotoUrl } from "../lib/photoUrl";

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
    isTrainer?: boolean;
    trainerHeadline?: string | null;
    trainerBio?: string | null;
    trainerExperienceYears?: number | null;
    trainerSpecializations?: string[];
    trainerFormats?: string[];
    trainerPriceFrom?: number | null;
    trainerContacts?: string | null;
  };
  comments: Comment[];
  trainerReviews: Array<{
    id: string;
    specialization: string;
    rating: number;
    text: string;
    createdAt: string;
    author: { id: string; name: string; photos: string[] };
  }>;
};

export function ProfileViewPage() {
  const { userId = "" } = useParams();
  const [myUserId, setMyUserId] = useState("");
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewSpecialization, setReviewSpecialization] = useState("");
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
  const trainerRatingStats = useMemo(() => {
    const rows = data?.trainerReviews || [];
    if (!rows.length) return null;
    const avg = rows.reduce((sum, r) => sum + r.rating, 0) / rows.length;
    return { avg, count: rows.length };
  }, [data?.trainerReviews]);

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
      setReviewText("");
      setReviewRating(5);
      setReviewSpecialization(
        payload?.profile?.trainerSpecializations?.[0] || ""
      );
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

  async function postTrainerReview(e: FormEvent) {
    e.preventDefault();
    if (!userId || !reviewText.trim() || !reviewSpecialization.trim()) return;
    try {
      await api.post(`/api/profiles/${userId}/trainer-reviews`, {
        specialization: reviewSpecialization.trim(),
        rating: reviewRating,
        text: reviewText.trim()
      });
      setReviewText("");
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось отправить отзыв");
    }
  }

  async function deleteTrainerReview(reviewId: string) {
    try {
      await api.delete(`/api/profiles/trainer-reviews/${reviewId}`);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || "Не удалось удалить отзыв");
    }
  }

  return (
    <div className="grid profile-view-page">
      <section className="card profile-view-main-card">
        <div className="profile-view-main-toolbar">
          <Link to="/" className="ghost-btn" style={{ width: "fit-content" }}>
            Назад в ленту
          </Link>
        </div>
        <div className="profile-view-scroll">
          {loading ? <p className="page-sub">Загружаем анкету...</p> : null}
          {error ? <div className="error">{error}</div> : null}
          {data ? (
            <div className="grid profile-view-inner">
              <div className="profile-view-photo">
                <div className="profile-view-photo-frame">
                  <img
                    className="profile-view-photo-main"
                    src={normalizePhotoUrl(photos[activePhoto])}
                    alt={`${data.profile.name} фото ${activePhoto + 1}`}
                  />
                </div>
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
              {data.profile.isTrainer ? (
                <div className="grid" style={{ marginTop: 12 }}>
                  <h3 className="page-title page-title--sm">Профиль тренера</h3>
                  {data.profile.trainerHeadline ? <p>{data.profile.trainerHeadline}</p> : null}
                  {data.profile.trainerBio ? <p className="page-sub">{data.profile.trainerBio}</p> : null}
                  <div className="chips">
                    {data.profile.trainerExperienceYears ? (
                      <span className="chip">Стаж: {data.profile.trainerExperienceYears} лет</span>
                    ) : null}
                    {data.profile.trainerPriceFrom ? (
                      <span className="chip">Цена от: {data.profile.trainerPriceFrom} ₽</span>
                    ) : null}
                    {trainerRatingStats ? (
                      <span className="chip">
                        Рейтинг: {trainerRatingStats.avg.toFixed(1)} ({trainerRatingStats.count})
                      </span>
                    ) : null}
                  </div>
                  {data.profile.trainerSpecializations?.length ? (
                    <p className="page-sub">
                      Специализации: {data.profile.trainerSpecializations.join(" · ")}
                    </p>
                  ) : null}
                  {data.profile.trainerFormats?.length ? (
                    <p className="page-sub">
                      Форматы: {data.profile.trainerFormats.join(" · ")}
                    </p>
                  ) : null}
                  {data.profile.trainerContacts ? (
                    <p className="page-sub">Контакты: {data.profile.trainerContacts}</p>
                  ) : null}
                </div>
              ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {data?.profile.isTrainer ? (
        <section className="card">
          <h3 className="page-title page-title--sm">Отзывы о тренере</h3>
          <form onSubmit={postTrainerReview} className="grid">
            <div className="grid two-col">
              <label className="field">
                <span className="field-label">Специализация</span>
                <select
                  value={reviewSpecialization}
                  onChange={(e) => setReviewSpecialization(e.target.value)}
                >
                  <option value="">Выбери специализацию</option>
                  {(data.profile.trainerSpecializations || []).map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">Оценка</span>
                <select
                  value={String(reviewRating)}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} / 5
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Опиши опыт работы с тренером по выбранной специализации..."
              maxLength={800}
            />
            <button
              className="primary-btn"
              type="submit"
              disabled={!reviewText.trim() || !reviewSpecialization.trim()}
            >
              Оставить отзыв
            </button>
          </form>
          <div className="list">
            {(data.trainerReviews || []).map((review) => (
              <div key={review.id} className="list-item">
                <div className="chat-list-head">
                  <span className="chat-list-name">{review.author.name}</span>
                  <span className="chat-list-sub">★ {review.rating}/5</span>
                </div>
                <span className="chip">{review.specialization}</span>
                <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
                  {review.text}
                </span>
                {myUserId === review.author.id || myUserId === data.profile.id ? (
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => void deleteTrainerReview(review.id)}
                  >
                    Удалить отзыв
                  </button>
                ) : null}
              </div>
            ))}
            {!(data.trainerReviews || []).length ? (
              <p className="page-sub">Пока отзывов нет.</p>
            ) : null}
          </div>
        </section>
      ) : null}

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

