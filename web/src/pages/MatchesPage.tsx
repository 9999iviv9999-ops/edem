import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Match = {
  id: string;
  userAId: string;
  userBId: string;
  userA: { id: string; name: string; photos: string[] };
  userB: { id: string; name: string; photos: string[] };
};

type Me = { id: string };

export function MatchesPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedMatchId) return;
    void loadMessages(selectedMatchId);
  }, [selectedMatchId]);

  async function load() {
    const [meRes, matchesRes] = await Promise.all([api.get("/api/profiles/me"), api.get("/api/matches")]);
    setMe({ id: meRes.data.id });
    setMatches(matchesRes.data);
    if (matchesRes.data.length) setSelectedMatchId(matchesRes.data[0].id);
  }

  async function loadMessages(matchId: string) {
    const { data } = await api.get(`/api/messages/${matchId}`);
    setMessages(data);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedMatchId || !text.trim()) return;
    await api.post("/api/messages", { matchId: selectedMatchId, text });
    setText("");
    await loadMessages(selectedMatchId);
  }

  const selected = useMemo(
    () => matches.find((m) => m.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  function otherName(m: Match) {
    if (!me) return "Пользователь";
    return m.userAId === me.id ? m.userB.name : m.userA.name;
  }

  return (
    <div className="match-layout">
      <aside className="card">
        <h3>Матчи</h3>
        <div className="list">
          {matches.map((m) => (
            <button
              key={m.id}
              className={`list-item ${m.id === selectedMatchId ? "active" : ""}`}
              onClick={() => setSelectedMatchId(m.id)}
            >
              {otherName(m)}
            </button>
          ))}
        </div>
      </aside>
      <section className="card">
        <h3>{selected ? `Чат с ${otherName(selected)}` : "Выбери матч"}</h3>
        <div className="chat-box">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.fromUserId === me?.id ? "own" : ""}`}>
              {m.text}
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="row">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Сообщение..." />
          <button className="primary-btn">Отправить</button>
        </form>
      </section>
    </div>
  );
}
