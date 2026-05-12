import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { normalizePhotoUrl } from "../lib/photoUrl";

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
  messages?: Array<{
    id: string;
    text: string;
    createdAt: string;
    fromUserId: string;
    readAt?: string | null;
    attachmentUrl?: string | null;
    attachmentMime?: string | null;
    attachmentFilename?: string | null;
    attachmentSize?: number | null;
  }>;
};

type Me = { id: string };
type Message = {
  id: string;
  fromUserId: string;
  text: string;
  createdAt: string;
  readAt?: string | null;
  attachmentUrl?: string | null;
  attachmentMime?: string | null;
  attachmentFilename?: string | null;
  attachmentSize?: number | null;
};

type PendingChatAttachment = { url: string; mimeType: string; filename: string; size: number };

const CHAT_BG_STORAGE_KEY = "edem_match_wallpaper_v1";

type ChatBgId = "default" | "aurora" | "ember" | "ocean" | "rose" | "midnight";

const CHAT_BG_PRESETS: { id: ChatBgId; label: string }[] = [
  { id: "default", label: "Стандартный" },
  { id: "aurora", label: "Северное сияние" },
  { id: "ember", label: "Закат" },
  { id: "ocean", label: "Океан" },
  { id: "rose", label: "Рассвет" },
  { id: "midnight", label: "Полночь" }
];

const CHAT_EMOJIS = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😊",
  "😍",
  "🥰",
  "😘",
  "😉",
  "😎",
  "🤔",
  "👍",
  "👎",
  "❤️",
  "🔥",
  "🎉",
  "👏",
  "🙏",
  "💪",
  "✨",
  "⭐",
  "😢",
  "😮",
  "🤝",
  "☕",
  "🙌",
  "💯",
  "🤗",
  "😅",
  "🙂",
  "👋",
  "💬"
];

function readChatBgMap(): Record<string, ChatBgId> {
  try {
    const raw = localStorage.getItem(CHAT_BG_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    const allowed = new Set(CHAT_BG_PRESETS.map((p) => p.id));
    const out: Record<string, ChatBgId> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (allowed.has(v as ChatBgId)) out[k] = v as ChatBgId;
    }
    return out;
  } catch {
    return {};
  }
}

function getChatBgForMatch(matchId: string): ChatBgId {
  return readChatBgMap()[matchId] ?? "default";
}

function saveChatBgForMatch(matchId: string, bg: ChatBgId) {
  const map = readChatBgMap();
  if (bg === "default") delete map[matchId];
  else map[matchId] = bg;
  localStorage.setItem(CHAT_BG_STORAGE_KEY, JSON.stringify(map));
}

function messagesListEqual(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.text !== y.text ||
      x.readAt !== y.readAt ||
      x.fromUserId !== y.fromUserId ||
      x.attachmentUrl !== y.attachmentUrl ||
      x.attachmentMime !== y.attachmentMime ||
      x.attachmentFilename !== y.attachmentFilename ||
      x.attachmentSize !== y.attachmentSize
    ) {
      return false;
    }
  }
  return true;
}

function formatDialogListPreview(msg: {
  text: string;
  attachmentUrl?: string | null;
  attachmentFilename?: string | null;
}): string {
  const has = Boolean(msg.attachmentUrl || msg.attachmentFilename);
  const t = (msg.text || "").trim();
  const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  if (has && !t) return `📎 ${cap(msg.attachmentFilename || "Файл", 28)}`;
  if (has && t) return `${cap(t, 36)} · 📎`;
  if (t) return cap(t, 72);
  return "Сообщение";
}

function stringArrayEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function DeliveryTicks({ read, title }: { read: boolean; title: string }) {
  return (
    <span className={`tg-read-ticks${read ? " tg-read-ticks--read" : ""}`} title={title} aria-hidden>
      <svg className="tg-read-svg" viewBox="0 0 22 12" width="19" height="11">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M1.5 6.5l3 3.2L9 2.8"
        />
        {read ? (
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 6.5l3 3.2L15 2.8"
          />
        ) : null}
      </svg>
    </span>
  );
}

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
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  /** Как в мессенджерах: автоскролл только если пользователь уже у нижнего края (не дёргать при опросе 3 с вверху истории). */
  const stickToBottomRef = useRef(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [bgPopoverOpen, setBgPopoverOpen] = useState(false);
  /** Смена фона для текущего диалога: перечитать из localStorage в том же матче. */
  const [chatBgRevision, setChatBgRevision] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<PendingChatAttachment | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);

  const NEAR_BOTTOM_PX = 100;
  function updateStickToBottomFromScroll() {
    const el = chatBoxRef.current;
    if (!el) return;
    const slack = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = slack <= NEAR_BOTTOM_PX;
  }

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
    stickToBottomRef.current = true;
  }, [selectedMatchId]);

  useEffect(() => {
    setEmojiOpen(false);
    setBgPopoverOpen(false);
    setPendingAttachment(null);
  }, [selectedMatchId]);

  useEffect(() => {
    if (!emojiOpen && !bgPopoverOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (composerShellRef.current?.contains(e.target as Node)) return;
      setEmojiOpen(false);
      setBgPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [emojiOpen, bgPopoverOpen]);

  useEffect(() => {
    if (!emojiOpen && !bgPopoverOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setEmojiOpen(false);
        setBgPopoverOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emojiOpen, bgPopoverOpen]);

  useLayoutEffect(() => {
    const el = chatBoxRef.current;
    if (!el || !selectedMatchId) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selectedMatchId, typingUserIds]);

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
      const rawMsgs: Message[] = Array.isArray(data?.messages) ? data.messages : [];
      const rawTyping: string[] = Array.isArray(data?.typingUserIds) ? data.typingUserIds : [];
      if (silent) {
        setMessages((prev) => (messagesListEqual(prev, rawMsgs) ? prev : rawMsgs));
        setTypingUserIds((prev) => (stringArrayEqual(prev, rawTyping) ? prev : rawTyping));
      } else {
        setMessages(rawMsgs);
        setTypingUserIds(rawTyping);
      }
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
    if (!selectedMatchId || (!text.trim() && !pendingAttachment) || uploadBusy) return;
    try {
      await api.post("/api/messages", {
        matchId: selectedMatchId,
        text: text.trim(),
        ...(pendingAttachment
          ? {
              attachmentUrl: pendingAttachment.url,
              attachmentMime: pendingAttachment.mimeType,
              attachmentFilename: pendingAttachment.filename,
              attachmentSize: pendingAttachment.size
            }
          : {})
      });
      setText("");
      setPendingAttachment(null);
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

  async function onChatFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedMatchId) return;
    setUploadBusy(true);
    setPageError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post<PendingChatAttachment & { mimeType: string }>("/api/media/upload-chat-file", fd);
      setPendingAttachment({
        url: data.url,
        mimeType: data.mimeType,
        filename: data.filename,
        size: data.size
      });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        navigate("/login");
        return;
      }
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setPageError(msg || "Не удалось загрузить файл");
    } finally {
      setUploadBusy(false);
    }
  }

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const chatBgId = useMemo(() => {
    if (!selectedMatchId) return "default" as ChatBgId;
    return getChatBgForMatch(selectedMatchId);
  }, [selectedMatchId, chatBgRevision]);
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

  function insertEmoji(ch: string) {
    const el = composerInputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + ch + text.slice(end);
    if (next.length > 1000) return;
    setText(next);
    window.requestAnimationFrame(() => {
      el?.focus();
      const pos = start + ch.length;
      try {
        el?.setSelectionRange(pos, pos);
      } catch {
        /* noop */
      }
    });
  }

  function renderDialogItem(m: Match) {
    const peer = otherUser(m);
    const lastMessage = m.messages?.[0];
    const preview = lastMessage ? formatDialogListPreview(lastMessage) : "Начните диалог";
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
            <img className="tg-dialog-avatar" src={normalizePhotoUrl(avatar)} alt={peer.name} />
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
        <div className="tg-dialog-oneline-mid" title={`${peer.name}${gymLabel ? gymLabel : ""} — ${preview}`}>
          <span className="tg-dialog-oneline-flow">
            <span className="tg-dialog-oneline-name">{peer.name}</span>
            {isPinned ? (
              <span className="chat-pin" aria-label="Закреплен">
                {" "}
                📌
              </span>
            ) : null}
            {peer.profileBadge?.trim() ? (
              <span className="tg-dialog-oneline-badge" title={peer.profileBadge.trim()}>
                {" "}
                · {peer.profileBadge.trim().length > 16 ? `${peer.profileBadge.trim().slice(0, 16)}…` : peer.profileBadge.trim()}
              </span>
            ) : null}
            <span className="tg-dialog-oneline-sep"> · </span>
            <span className="tg-dialog-oneline-snippet">
              {preview}
              {gymLabel ? <span className="chat-list-sub compact">{gymLabel}</span> : null}
            </span>
          </span>
        </div>
        <div className="tg-dialog-oneline-meta">
          {m.unreadCount ? <span className="chat-unread-badge">{m.unreadCount > 99 ? "99+" : m.unreadCount}</span> : null}
          <span className="tg-dialog-time">{formatDialogTime(m.lastActivityAt || lastMessage?.createdAt)}</span>
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
      <section className="tg-chat-card">
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
                <img className="tg-dialog-avatar" src={normalizePhotoUrl(otherUser(selected).photos[0])} alt={otherName(selected)} />
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
        <div
          className="tg-chat-box"
          ref={chatBoxRef}
          data-bg={chatBgId}
          onScroll={updateStickToBottomFromScroll}
        >
          {loadingMessages ? <div className="page-sub">Загрузка сообщений...</div> : null}
          {messages.map((m, idx) => {
            const isOwn = m.fromUserId === me?.id;
            const isLastOwn = isOwn && messages.slice(idx + 1).every((next) => next.fromUserId !== me?.id);
            const attUrl = m.attachmentUrl ? normalizePhotoUrl(m.attachmentUrl) : "";
            const isImg = Boolean(m.attachmentMime?.toLowerCase().startsWith("image/") && attUrl);
            return (
              <div key={m.id} className={`bubble ${isOwn ? "own" : ""}`}>
                {isImg ? (
                  <a className="tg-attach-img-wrap" href={attUrl} target="_blank" rel="noopener noreferrer">
                    <img className="tg-attach-img" src={attUrl} alt="" loading="lazy" />
                  </a>
                ) : null}
                {m.attachmentUrl && !isImg ? (
                  <a
                    className="tg-attach-link"
                    href={attUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={m.attachmentFilename || undefined}
                  >
                    📎 {m.attachmentFilename || "Скачать файл"}
                  </a>
                ) : null}
                {(m.text || "").trim() ? <div className="tg-bubble-text">{m.text}</div> : null}
                <div className="bubble-meta">
                  <span>{formatTime(m.createdAt)}</span>
                  {isLastOwn ? (
                    <DeliveryTicks read={Boolean(m.readAt)} title={m.readAt ? "Прочитано" : "Отправлено"} />
                  ) : null}
                </div>
              </div>
            );
          })}
          {selected && typingUserIds.length > 0 ? <div className="typing-indicator">{typingName()} печатает...</div> : null}
        </div>
        <input
          ref={chatFileInputRef}
          type="file"
          className="tg-attach-input-hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.txt,application/pdf"
          onChange={onChatFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <div ref={composerShellRef} className="tg-composer-shell">
          {pendingAttachment ? (
            <div className="tg-composer-pending">
              <span className="tg-composer-pending-name" title={pendingAttachment.filename}>
                {uploadBusy ? "Загрузка…" : `📎 ${pendingAttachment.filename}`}
              </span>
              <button
                type="button"
                className="tg-composer-pending-remove"
                disabled={uploadBusy}
                onClick={() => setPendingAttachment(null)}
                aria-label="Убрать вложение"
              >
                ×
              </button>
            </div>
          ) : null}
          <form onSubmit={sendMessage} className="tg-composer">
          <div className="tg-composer-tools">
            <button
              type="button"
              className="tg-composer-icon-btn tg-composer-icon-btn--attach"
              aria-label="Вложение"
              title="Фото или документ"
              disabled={!selectedMatchId || uploadBusy}
              onClick={() => chatFileInputRef.current?.click()}
            >
              <svg className="tg-attach-svg" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.49"
                />
              </svg>
            </button>
            <button
              type="button"
              className="tg-composer-icon-btn"
              aria-label="Смайлики"
              aria-expanded={emojiOpen}
              disabled={!selectedMatchId}
              onClick={() => {
                setBgPopoverOpen(false);
                setEmojiOpen((v) => !v);
              }}
            >
              <span aria-hidden>😊</span>
            </button>
            <button
              type="button"
              className="tg-composer-icon-btn"
              aria-label="Фон чата"
              title="Фон только в этом браузере"
              aria-expanded={bgPopoverOpen}
              disabled={!selectedMatchId}
              onClick={() => {
                setEmojiOpen(false);
                setBgPopoverOpen((v) => !v);
              }}
            >
              <span aria-hidden>🎨</span>
            </button>
            {emojiOpen ? (
              <div className="tg-composer-popover" role="dialog" aria-label="Выбор эмодзи">
                <div className="tg-emoji-grid">
                  {CHAT_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="tg-emoji-cell"
                      onClick={() => insertEmoji(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {bgPopoverOpen && selectedMatchId ? (
              <div className="tg-composer-popover" role="dialog" aria-label="Фон переписки">
                <p className="tg-composer-popover-hint">Сохраняется отдельно для каждого диалога на этом устройстве.</p>
                <div className="tg-wallpaper-list">
                  {CHAT_BG_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`tg-wallpaper-option${chatBgId === p.id ? " tg-wallpaper-option--active" : ""}`}
                      onClick={() => {
                        saveChatBgForMatch(selectedMatchId, p.id);
                        setChatBgRevision((r) => r + 1);
                        setBgPopoverOpen(false);
                      }}
                    >
                      <span className={`tg-wallpaper-swatch tg-wallpaper-swatch--${p.id}`} aria-hidden />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <input
            ref={composerInputRef}
            className="tg-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={pendingAttachment ? "Подпись (необязательно)…" : "Сообщение..."}
            disabled={!selectedMatchId || uploadBusy}
            maxLength={1000}
            autoComplete="off"
          />
          <button
            type="submit"
            className="tg-send-fab"
            disabled={!selectedMatchId || uploadBusy || (!text.trim() && !pendingAttachment)}
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
        </div>
      </section>
    </div>
  );
}
