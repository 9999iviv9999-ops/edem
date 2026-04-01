import { useEffect, useState } from "react";
import { GymPicker } from "../components/GymPicker";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string; chainName?: string | null };
type Profile = { id: string; name: string; age: number; description?: string; photos: string[] };

export function FeedPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [userCity, setUserCity] = useState("");
  const [gymId, setGymId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    const meRes = await api.get("/api/profiles/me");
    const city = meRes.data.city || "Москва";
    setUserCity(city);
    const gymsRes = await api.get("/api/gyms", { params: { city } });
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
        <div className="full">
          <GymPicker
            gyms={gyms}
            city={userCity}
            value={gymId}
            onChange={async (id) => {
              setGymId(id);
              if (id) await loadProfiles(id);
              else setProfiles([]);
            }}
            onImported={(g) =>
              setGyms((prev) => (prev.some((x) => x.id === g.id) ? prev : [...prev, g]))
            }
          />
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
