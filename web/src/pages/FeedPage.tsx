import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string };
type Profile = { id: string; name: string; age: number; description?: string; photos: string[] };

export function FeedPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const [gymsRes, meRes] = await Promise.all([api.get("/api/gyms"), api.get("/api/profiles/me")]);
    setGyms(gymsRes.data);
    const main = meRes.data.memberships.find((m: any) => m.isPrimary)?.gymId;
    if (main) {
      setGymId(main);
      await loadProfiles(main);
    }
  }

  async function loadProfiles(selectedGymId: string) {
    const { data } = await api.get(`/api/profiles/gyms/${selectedGymId}`);
    setProfiles(data);
  }

  async function like(toUserId: string) {
    if (!gymId) return;
    const { data } = await api.post("/api/likes", { toUserId, gymId });
    setProfiles((s) => s.filter((p) => p.id !== toUserId));
    setMessage(data.match ? "Взаимный лайк! У вас матч." : "Лайк отправлен");
  }

  return (
    <div className="grid">
      <div className="card">
        <h2 className="page-title">Лента</h2>
        <p className="page-sub">
          Люди в твоём зале — как тропинки в одном саду. Выбери зал и смотри анкеты тех, кто тренируется
          рядом с тобой.
        </p>
        <div className="row">
          <select
            value={gymId}
            onChange={async (e) => {
              const id = e.target.value;
              setGymId(id);
              await loadProfiles(id);
            }}
          >
            <option value="">Выбери зал</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.city})
              </option>
            ))}
          </select>
        </div>
        {message && <div className="success">{message}</div>}
      </div>

      <div className="cards-grid">
        {profiles.map((p) => (
          <article className="profile-card" key={p.id}>
            <img
              src={p.photos?.[0] || "https://placehold.co/500x320?text=No+Photo"}
              alt={p.name}
            />
            <div className="profile-body">
              <h3>
                {p.name}, {p.age}
              </h3>
              <p>{p.description || "Люблю тренировки и активный образ жизни."}</p>
              <button className="primary-btn" onClick={() => like(p.id)}>
                Лайк
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
