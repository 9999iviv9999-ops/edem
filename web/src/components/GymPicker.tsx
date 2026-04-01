import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export type GymOption = { id: string; name: string; city: string; chainName?: string | null };

type MapHit = {
  source: "dgis" | "yandex";
  externalId: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  category?: string;
};

type MapsStatus = { dgis: boolean; yandex: boolean };

type Props = {
  gyms: GymOption[];
  value: string;
  onChange: (gymId: string) => void;
  /** Город профиля — для онлайн-поиска по 2ГИС / Яндексу */
  city: string;
  /** После импорта зала из карт — обновить локальный список */
  onImported?: (g: GymOption) => void;
  id?: string;
  placeholder?: string;
};

/**
 * Выбор зала: локальный каталог + поиск по 2ГИС и Яндексу (если заданы ключи на сервере).
 */
export function GymPicker({
  gyms,
  value,
  onChange,
  city,
  onImported,
  id,
  placeholder = "Начните вводить название зала или сети"
}: Props) {
  const [q, setQ] = useState("");
  const [mapCfg, setMapCfg] = useState<MapsStatus | null>(null);
  const [mapHits, setMapHits] = useState<MapHit[]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapErr, setMapErr] = useState("");
  const [pendingMap, setPendingMap] = useState("");
  const [impLoading, setImpLoading] = useState(false);

  useEffect(() => {
    void api
      .get<MapsStatus>("/api/gyms/maps/status")
      .then((r) => setMapCfg(r.data))
      .catch(() => setMapCfg({ dgis: false, yandex: false }));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return gyms;
    return gyms.filter((g) => {
      const name = g.name.toLowerCase();
      const chain = (g.chainName || "").toLowerCase();
      return name.includes(s) || chain.includes(s);
    });
  }, [gyms, q]);

  const selected = gyms.find((g) => g.id === value);

  const mapsOnline = Boolean(mapCfg?.dgis || mapCfg?.yandex);

  async function loadMaps() {
    if (!city.trim()) {
      setMapErr("Сначала укажи город в профиле");
      return;
    }
    setMapLoading(true);
    setMapErr("");
    try {
      const { data } = await api.get<{ items: MapHit[] }>("/api/gyms/maps/search", {
        params: { city: city.trim(), q: q.trim() || undefined }
      });
      setMapHits(data.items || []);
      setPendingMap("");
      if (!(data.items || []).length) {
        setMapErr("По запросу ничего не найдено — измени текст поиска выше и попробуй снова");
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string }; status?: number } };
      const msg =
        ax.response?.data?.error ||
        (ax.response?.status === 503
          ? "На сервере не настроены ключи API (см. .env)"
          : "Не удалось обратиться к картам");
      setMapErr(String(msg));
      setMapHits([]);
    } finally {
      setMapLoading(false);
    }
  }

  async function importSelected() {
    const hit = mapHits.find((h) => `${h.source}|${h.externalId}` === pendingMap);
    if (!hit) return;
    setImpLoading(true);
    setMapErr("");
    try {
      const { data } = await api.post<GymOption & { id: string }>("/api/gyms/import-from-map", {
        provider: hit.source,
        externalId: hit.externalId,
        name: hit.name,
        address: hit.address,
        city: hit.city,
        latitude: hit.latitude,
        longitude: hit.longitude,
        category: hit.category
      });
      const opt: GymOption = {
        id: data.id,
        name: data.name,
        city: data.city,
        chainName: data.chainName
      };
      onImported?.(opt);
      onChange(data.id);
      setPendingMap("");
    } catch {
      setMapErr("Не удалось сохранить зал");
    } finally {
      setImpLoading(false);
    }
  }

  return (
    <div className="gym-picker">
      <div className="field">
        <span className="field-label">Поиск зала</span>
        <input
          type="search"
          autoComplete="off"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <label className="field">
        <span className="field-label">Фитнес-центр / зал (каталог Edem)</span>
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Выберите зал</option>
          {value && selected && !filtered.some((g) => g.id === value) && (
            <option value={value}>{selected.name}</option>
          )}
          {filtered.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p className="gym-picker-meta">
        В твоём городе в каталоге: <strong>{gyms.length}</strong>
        {q.trim() ? (
          <>
            {" "}
            · по фильтру: <strong>{filtered.length}</strong>
          </>
        ) : null}
      </p>
      {selected && !filtered.some((g) => g.id === value) && (
        <p className="gym-picker-hint">
          Текущий зал «{selected.name}» скрыт фильтром — очистите поиск, чтобы увидеть его в списке.
        </p>
      )}
      {q.trim() && filtered.length === 0 && (
        <p className="city-select-empty">В каталоге ничего не найдено — попробуй онлайн-поиск ниже</p>
      )}

      {mapCfg && (
        <div className="gym-picker-maps">
          <p className="gym-picker-maps-title">Поиск на картах</p>
          <p className="gym-picker-maps-status">
            2ГИС: {mapCfg.dgis ? "подключено" : "нет ключа"} · Яндекс:{" "}
            {mapCfg.yandex ? "подключено" : "нет ключа"}
          </p>
          {mapsOnline ? (
            <>
              <button type="button" className="ghost-btn gym-picker-maps-btn" disabled={mapLoading} onClick={() => void loadMaps()}>
                {mapLoading ? "Запрос к 2ГИС и Яндексу…" : "Найти залы на 2ГИС и Яндексе"}
              </button>
              {mapErr && <p className="city-select-empty">{mapErr}</p>}
              {mapHits.length > 0 && (
                <>
                  <label className="field">
                    <span className="field-label">Организации с карт</span>
                    <select value={pendingMap} onChange={(e) => setPendingMap(e.target.value)}>
                      <option value="">Выбери точку</option>
                      {mapHits.map((h) => (
                        <option key={`${h.source}-${h.externalId}`} value={`${h.source}|${h.externalId}`}>
                          {h.source === "dgis" ? "2ГИС" : "Яндекс"} · {h.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!pendingMap || impLoading}
                    onClick={() => void importSelected()}
                  >
                    {impLoading ? "Сохраняем…" : "Добавить выбранный зал в каталог и выбрать"}
                  </button>
                  <p className="gym-picker-legal">
                    Данные 2ГИС и Яндекса используются по их правилам; ключи задаются на сервере в переменных{" "}
                    <code>DGIS_API_KEY</code> и <code>YANDEX_MAPS_API_KEY</code>.
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="city-select-hint">
              Чтобы искать реальные залы на картах, добавь в <code>.env</code> бэкенда ключи{" "}
              <code>DGIS_API_KEY</code> (личный кабинет 2ГИС) и <code>YANDEX_MAPS_API_KEY</code> (кабинет
              разработчика Яндекса, API поиска по организациям).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
