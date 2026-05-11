import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type Match = {
  id: string;
  gymId: string;
  createdAt?: string;
  unreadCount?: number;
  lastActivityAt?: string;
  userAId: string;
  userBId: string;
  userA: { id: string; name: string; photos: string[]; profileBadge?: string | null };
  userB: { id: string; name: string; photos: string[]; profileBadge?: string | null };
  gym?: { id: string; name: string };
  messages?: Array<{ id: string; text: string; createdAt: string; fromUserId: string; readAt?: string | null }>;
};

type Me = { id: string };
type Message = { id: string; fromUserId: string; text: string; createdAt: string; readAt?: string | null };

export function MatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialogsFilter, setDialogsFilter] = useState<"all" | "unread">("all");
  const [text, setText] = useState("");
  const [pinnedMatchIds, setPinnedMatchIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("edem_pinned_dialogs");
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const lastTypingSentRef = useRef(false);
  const chatBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedMatchId) return;
    void loadMessages(selectedMatchId);
    const timer = window.setInterval(() => {
      void loadMessages(selectedMatchId, true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages, selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId) return;
    const isTyping = text.trim().length > 0;
    if (isTyping === lastTypingSentRef.current) return;
    lastTypingSentRef.current = isTyping;
    void api.post("/api/messages/typing", {
      matchId: selectedMatchId,
      isTyping
    });
  }, [text, selectedMatchId]);

  async function load() {
    setPageError("");
    try {
      const [meRes, matchesRes] = await Promise.all([api.get("/api/profiles/me"), api.get("/api/matches")]);
      const meId = meRes.data.id as string;
      setMe({ id: meId });
      let nextMatches = matchesRes.data as Match[];

      const toUserId = searchParams.get("userId");
      const gymId = searchParams.get("gymId");
      if (toUserId && gymId) {
        try {
          const started = await api.post("/api/messages/start", { toUserId, gymId });
          const startedId = started.data?.id as string | undefined;
          if (startedId && !nextMatches.some((m) => m.id === startedId)) {
            const refreshed = await api.get("/api/matches");
            nextMatches = refreshed.data as Match[];
          }
          if (startedId) {
            setSelectedMatchId(startedId);
            navigate("/messages", { replace: true });
          }
        } catch {
          // Keep page usable even if direct start fails.
        }
      }

      setMatches(nextMatches);
      // Keep dialogs list as the default entry point.
      // Open a chat automatically only for explicit deep-link start (/messages?userId=...&gymId=...).
      if (selectedMatchId && !nextMatches.some((m) => m.id === selectedMatchId)) {
        setSelectedMatchId("");
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        navigate("/login");
        return;
      }
      setPageError("Не удалось загрузить диалоги");
    }
  }

  async function loadMessages(matchId: string, silent = false) {
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await api.get(`/api/messages/${matchId}`);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setTypingUserIds(Array.isArray(data?.typingUserIds) ? data.typingUserIds : []);
      setPageError("");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        navigate("/login");
        return;
      }
      if (!silent) setPageError("Не удалось загрузить сообщения");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedMatchId || !text.trim()) return;
    try {
      await api.post("/api/messages", { matchId: selectedMatchId, text });
      setText("");
      lastTypingSentRef.current = false;
      await api.post("/api/messages/typing", { matchId: selectedMatchId, isTyping: false });
      await loadMessages(selectedMatchId);
      await load();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        navigate("/login");
        return;
      }
      setPageError("Не удалось отправить сообщение");
    }
  }

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedMatchId),
    [matches, selectedMatchId]
  );
  const sortedMatches = useMemo(() => {
    const pinnedSet = new Set(pinnedMatchIds);
    const sorted = [...matches].sort((a, b) => {
      const aPinned = pinnedSet.has(a.id) ? 1 : 0;
      const bPinned = pinnedSet.has(b.id) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      const aUnread = a.unreadCount ?? 0;
      const bUnread = b.unreadCount ?? 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const bTs = b.lastActivityAt || b.createdAt || "1970-01-01T00:00:00.000Z";
      const aTs = a.lastActivityAt || a.createdAt || "1970-01-01T00:00:00.000Z";
      return new Date(bTs).getTime() - new Date(aTs).getTime();
    });
    return sorted;
  }, [matches, pinnedMatchIds]);
  const unreadMatches = useMemo(() => sortedMatches.filter((m) => (m.unreadCount ?? 0) > 0), [sortedMatches]);
  const otherMatches = useMemo(() => sortedMatches.filter((m) => (m.unreadCount ?? 0) === 0), [sortedMatches]);
  const visibleMatches = useMemo(
    () => (dialogsFilter === "unread" ? unreadMatches : sortedMatches),
    [dialogsFilter, unreadMatches, sortedMatches]
  );

  useEffect(() => {
    localStorage.setItem("edem_pinned_dialogs", JSON.stringify(pinnedMatchIds));
  }, [pinnedMatchIds]);

  function otherName(m: Match) {
    if (!me) return "Пользователь";
    return m.userAId === me.id ? m.userB.name : m.userA.name;
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function formatDialogTime(iso?: string) {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return formatTime(iso);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  }

  function otherUser(m: Match) {
    if (!me) return m.userA;
    return m.userAId === me.id ? m.userB : m.userA;
  }

  function typingName() {
    if (!selected || typingUserIds.length === 0) return "";
    const byId = new Map([
      [selected.userA.id, selected.userA.name],
      [selected.userB.id, selected.userB.name]
    ]);
    return byId.get(typingUserIds[0]) ?? "Собеседник";
  }

  function onlineHint() {
    if (!selected?.lastActivityAt) return "был(а) недавно";
    const diffMs = Date.now() - new Date(selected.lastActivityAt).getTime();
    if (diffMs <= 5 * 60 * 1000) return "в сети";
    if (diffMs <= 60 * 60 * 1000) return "был(а) недавно";
    return "не в сети";
  }

  function togglePin(matchId: string) {
    setPinnedMatchIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [matchId, ...prev]
    );
  }

  function renderDialogItem(m: Match) {
    const peer = otherUser(m);
    const lastMessage = m.messages?.[0];
    const preview = lastMessage?.text || "Начните диалог";
    const gymLabel = m.gym?.name ? ` · ${m.gym.name}` : "";
    const avatar = peer.photos?.[0];
    const isPinned = pinnedMatchIds.includes(m.id);
    return (
      <div
        key={m.id}
        className={`list-item tg-dialog-item ${m.id === selectedMatchId ? "active" : ""}`}
        onClick={() => setSelectedMatchId(m.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedMatchId(m.id);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {avatar ? (
          <Link
            to={`/profiles/${peer.id}`}
            className="tg-dialog-avatar-link"
            onClick={(e) => e.stopPropagation()}
          >
            <img className="tg-dialog-avatar" src={avatar} alt={peer.name} />
          </Link>
        ) : (
          <Link
            to={`/profiles/${peer.id}`}
            className="tg-dialog-avatar-link"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tg-dialog-avatar tg-dialog-avatar--fallback">{peer.name.slice(0, 1).toUpperCase()}</div>
          </Link>
        )}
        <div className="tg-dialog-main">
          <div className="chat-list-head">
            <span className="chat-list-name">
              {peer.name}
              {isPinned ? <span className="chat-pin" aria-label="Закреплен">📌</span> : null}
            </span>
            <span className="tg-dialog-time">{formatDialogTime(m.lastActivityAt || lastMessage?.createdAt)}</span>
          </div>
          <div className="tg-dialog-subrow">
            {peer.profileBadge?.trim() ? (
              <span className="profile-badge-chip" style={{ marginTop: 4, marginBottom: 2 }}>
                {peer.profileBadge.trim()}
              </span>
            ) : null}
            <span className="chat-list-preview">
              {preview}
              <span className="chat-list-sub compact">{gymLabel}</span>
            </span>
            {m.unreadCount ? <span className="chat-unread-badge">{m.unreadCount}</span> : null}
            <button
              className="tg-pin-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(m.id);
              }}
            >
              {isPinned ? "Открепить" : "Закрепить"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`match-layout tg-layout ${selected ? "mobile-chat-active" : ""}`}>
      <aside className="card tg-sidebar">
        <h3 className="page-title page-title--sm tg-sidebar-title">Сообщения</h3>
        <div className="tg-filter-tabs">
          <button
            type="button"
            className={`tg-filter-tab ${dialogsFilter === "all" ? "active" : ""}`}
            onClick={() => setDialogsFilter("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={`tg-filter-tab ${dialogsFilter === "unread" ? "active" : ""}`}
            onClick={() => setDialogsFilter("unread")}
          >
            Непрочитанные
          </button>
        </div>
        <div className="list">
          {pageError ? <div className="error">{pageError}</div> : null}
          {dialogsFilter === "all" && unreadMatches.length > 0 ? <div className="list-group-title">Непрочитанные</div> : null}
          {dialogsFilter === "all" ? unreadMatches.map(renderDialogItem) : null}
          {dialogsFilter === "all" && otherMatches.length > 0 ? <div className="list-group-title">Остальные</div> : null}
          {dialogsFilter === "all"
            ? otherMatches.map(renderDialogItem)
            : visibleMatches.map(renderDialogItem)}
          {visibleMatches.length === 0 ? <div className="page-sub">Диалогов пока нет.</div> : null}
        </div>
      </aside>
      <section className="card tg-chat-card">
        {selected ? (
          <div className="tg-chat-header">
            <button type="button" className="tg-mobile-back" onClick={() => setSelectedMatchId("")} aria-label="Назад к диалогам">
              <span aria-hidden className="tg-mobile-back-icon">❮</span>
              <span className="sr-only">Назад</span>
            </button>
            <Link
              to={`/profiles/${otherUser(selected).id}`}
              className="tg-chat-header-profile"
            >
              {otherUser(selected).photos?.[0] ? (
                <img className="tg-dialog-avatar" src={otherUser(selected).photos[0]} alt={otherName(selected)} />
              ) : (
                <div className="tg-dialog-avatar tg-dialog-avatar--fallback">
                  {otherName(selected).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="tg-chat-header-meta">
                <h3>{otherName(selected)}</h3>
                {(() => {
                  const b = otherUser(selected).profileBadge?.trim();
                  return b ? (
                    <span className="profile-badge-chip" style={{ margin: "4px 0" }}>
                      {b}
                    </span>
                  ) : null;
                })()}
                <p>
                  <span className={`tg-status-dot ${typingUserIds.length > 0 || onlineHint() === "в сети" ? "online" : ""}`} />
                  {selected.gym?.name || "Выбранный зал"} ·{" "}
                  {typingUserIds.length > 0 ? `${typingName()} печатает...` : onlineHint()}
                </p>
              </div>
            </Link>
          </div>
        ) : (
          <h3>Выбери диалог</h3>
        )}
        <div className="tg-chat-box" ref={chatBoxRef}>
          {loadingMessages ? <div className="page-sub">Загрузка сообщений...</div> : null}
          {messages.map((m, idx) => {
            const isOwn = m.fromUserId === me?.id;
            const isLastOwn = isOwn && messages.slice(idx + 1).every((next) => next.fromUserId !== me?.id);
            const readState = m.readAt ? "✓✓" : "✓";
            return (
              <div key={m.id} className={`bubble ${isOwn ? "own" : ""}`}>
                <div>{m.text}</div>
                <div className="bubble-meta">
                  <span>{formatTime(m.createdAt)}</span>
                  {isLastOwn ? <span title={m.readAt ? "Прочитано" : "Отправлено"}>{readState}</span> : null}
                </div>
              </div>
            );
          })}
          {selected && typingUserIds.length > 0 ? <div className="typing-indicator">{typingName()} печатает...</div> : null}
        </div>
        <form onSubmit={sendMessage} className="tg-composer">
          <input
            className="tg-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Сообщение..."
            disabled={!selectedMatchId}
            maxLength={1000}
            autoComplete="off"
          />
          <button
            type="submit"
            className="tg-send-fab"
            disabled={!selectedMatchId || !text.trim()}
            aria-label="Отправить"
          >
            <svg className="tg-send-fab-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              />
            </svg>
          </button>
        </form>
      </section>
    </div>
  );
}
