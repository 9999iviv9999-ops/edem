import { useEffect, useState } from "react";
import { AdminAreaSelect, isSingleOkrugCity } from "../components/AdminAreaSelect";
import { CitySelect } from "../components/CitySelect";
import { GymPicker } from "../components/GymPicker";
import { api } from "../lib/api";

type Gym = { id: string; name: string; city: string; chainName?: string | null };
type Profile = { id: string; name: string; age: number; description?: string; photos: string[] };

export function FeedPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [gymId, setGymId] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [city, setCity] = useState("Москва");
  const [okrug, setOkrug] = useState("");
  const [district, setDistrict] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  async function persistLocation(nextCity: string, nextOkrug: string, nextDistrict: string) {
    try {
      await api.patch("/api/profiles/me/location", {
        city: nextCity,
        okrug: nextOkrug,
        district: nextDistrict
      });
      setErrorMessage("");
    } catch {
      setErrorMessage("Не удалось сохранить город — попробуйте ещё раз");
    }
  }

  async function onCityChange(nextCity: string) {
    if (!nextCity || nextCity === city) return;
    setMessage("");
    setErrorMessage("");
    const { data } = await api.get("/api/gyms", { params: { city: nextCity } });
    setGyms(data);
    setCity(nextCity);
    setOkrug("");
    setDistrict("");
    setGymId("");
    setProfiles([]);
    await persistLocation(nextCity, "", "");
  }

  async function onOkrugChange(nextOkrug: string) {
    setMessage("");
    setErrorMessage("");
    const { data } = await api.get("/api/gyms", {
      params: { city, okrug: nextOkrug || undefined }
    });
    setGyms(data);
    setOkrug(nextOkrug);
    setDistrict("");
    setGymId("");
    setProfiles([]);
    await persistLocation(city, nextOkrug, "");
  }

  async function onDistrictChange(nextDistrict: string) {
    setMessage("");
    setErrorMessage("");
    const params: Record<string, string | undefined> = {
      city,
      district: nextDistrict || undefined
    };
    if (!isSingleOkrugCity(city) && okrug) params.okrug = okrug;
    const { data } = await api.get("/api/gyms", { params });
    setGyms(data);
    setDistrict(nextDistrict);
    setGymId("");
    setProfiles([]);
    const ok = isSingleOkrugCity(city) ? "" : okrug;
    await persistLocation(city, ok, nextDistrict);
  }

  async function bootstrap() {
    const meRes = await api.get("/api/profiles/me");
    const me = meRes.data;
    const nextCity = me.city || "Москва";
    const nextOkrug = me.okrug || "";
    const nextDistrict = me.district || "";
    setCity(nextCity);
    setOkrug(nextOkrug);
    setDistrict(nextDistrict);

    const gymParams: Record<string, string | undefined> = {
      city: nextCity,
      district: nextDistrict || undefined
    };
    if (!isSingleOkrugCity(nextCity) && nextOkrug) gymParams.okrug = nextOkrug;
    const gymsRes = await api.get("/api/gyms", { params: gymParams });
    setGyms(gymsRes.data);
    const main = me.memberships.find((m: { isPrimary?: boolean }) => m.isPrimary)?.gymId;
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
      <section className="card feed-hero">
        <div className="feed-hero-image-wrap">
          <img
            className="feed-hero-image"
            src="/edem-hero.png"
            alt="Edem — знакомства в зале"
            loading="eager"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      </section>

      <div className="card">
        <h2 className="page-title">Лента</h2>
        <p className="page-sub">
          Люди в твоём зале — как тропинки в одном саду. Выбери город и зал, смотри анкеты тех, кто тренируется рядом с
          тобой.
        </p>

        <div className="full feed-location">
          <h3 className="profile-section-title">Город и район</h3>
          <p className="page-sub feed-location-hint">
            Как в профиле: город, при необходимости округ и район — список залов обновится и сохранится в анкете.
          </p>
          <div className="grid two-col">
            <div className="full">
              <CitySelect value={city} onChange={(c) => void onCityChange(c)} />
            </div>
            <div className="full">
              <AdminAreaSelect
                city={city}
                okrug={okrug}
                district={district}
                onOkrugChange={(o) => void onOkrugChange(o)}
                onDistrictChange={(d) => void onDistrictChange(d)}
              />
            </div>
          </div>
        </div>

        <div className="full">
          <GymPicker
            gyms={gyms}
            value={gymId}
            onChange={async (id) => {
              setGymId(id);
              if (id) await loadProfiles(id);
              else setProfiles([]);
            }}
          />
        </div>
        {errorMessage && <div className="error">{errorMessage}</div>}
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
