import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../lib/env";

const DG_ITEMS = "https://catalog.api.2gis.com/3.0/items";
const YANDEX_SEARCH = "https://search-maps.yandex.ru/v1/";

export type MapDirectoryHit = {
  source: "dgis" | "yandex";
  externalId: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  category?: string;
};

type Centers = Record<string, { lat: number; lon: number }>;

const centers: Centers = JSON.parse(
  readFileSync(join(__dirname, "../data/cityCenters.json"), "utf8")
) as Centers;

/** Центр города для привязки поиска (lon, lat в градусах). */
export function getCityCenterLonLat(city: string): { lon: number; lat: number } {
  const c = centers[city];
  if (c) return { lon: c.lon, lat: c.lat };
  return { lon: 37.620405, lat: 55.7540471 };
}

export function mapsKeysConfigured(): { dgis: boolean; yandex: boolean } {
  return {
    dgis: Boolean(env.DGIS_API_KEY),
    yandex: Boolean(env.YANDEX_MAPS_API_KEY)
  };
}

function parse2gisPoint(item: Record<string, unknown>): { lat: number | null; lon: number | null } {
  const p = item.point as Record<string, unknown> | string | undefined;
  if (p && typeof p === "object") {
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lon = typeof p.lon === "number" ? p.lon : null;
    if (lat != null && lon != null) return { lat, lon };
  }
  if (typeof p === "string") {
    const parts = p.trim().split(/\s+/).map(Number);
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      return { lon: parts[0], lat: parts[1] };
    }
  }
  return { lat: null, lon: null };
}

function dedupeByExternalId(hits: MapDirectoryHit[]): MapDirectoryHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.source}:${h.externalId}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Поиск филиалов по 2ГИС Places API (несколько страниц).
 */
export async function search2gis(city: string, query: string): Promise<MapDirectoryHit[]> {
  const key = env.DGIS_API_KEY;
  if (!key) return [];

  const { lon, lat } = getCityCenterLonLat(city);
  const qText = [query.trim(), "фитнес тренажёрный зал спорт", city].filter(Boolean).join(" ").trim();

  const out: MapDirectoryHit[] = [];

  for (let page = 1; page <= 4; page++) {
    const u = new URL(DG_ITEMS);
    u.searchParams.set("key", key);
    u.searchParams.set("q", qText);
    u.searchParams.set("type", "branch");
    u.searchParams.set("page_size", "50");
    u.searchParams.set("page", String(page));
    u.searchParams.set("locale", "ru_RU");
    u.searchParams.set("search_type", "discovery");
    u.searchParams.set("location", `${lon},${lat}`);
    u.searchParams.set("fields", "items.point,items.address,items.full_address_name,items.rubrics");

    const r = await fetch(u.toString(), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) break;

    const j = (await r.json()) as {
      meta?: { code?: number };
      result?: { items?: Record<string, unknown>[] };
    };
    if (j.meta?.code !== 200) break;

    const items = j.result?.items || [];
    if (!items.length) break;

    for (const it of items) {
      const addr =
        (it.full_address_name as string) ||
        (it.address_name as string) ||
        ((it.address as { value?: string })?.value ?? "");
      const rubrics = it.rubrics as { name?: string }[] | undefined;
      const rub = rubrics?.[0]?.name || "";
      const { lat: la, lon: lo } = parse2gisPoint(it);

      out.push({
        source: "dgis",
        externalId: String(it.id),
        name: String(it.name || "").trim() || "Без названия",
        address: String(addr).trim() || city,
        city,
        latitude: la,
        longitude: lo,
        category: rub
      });
    }

    if (items.length < 50) break;
  }

  return dedupeByExternalId(out);
}

/**
 * Поиск организаций через Яндекс Geosearch (type=biz).
 * Условия использования данных — по лицензии Яндекса; кэширование может быть ограничено.
 */
export async function searchYandex(city: string, query: string): Promise<MapDirectoryHit[]> {
  const apikey = env.YANDEX_MAPS_API_KEY;
  if (!apikey) return [];

  const { lon, lat } = getCityCenterLonLat(city);
  const text = `${city} ${query.trim() || "фитнес клуб тренажёрный зал"}`.trim();

  const out: MapDirectoryHit[] = [];

  for (const skip of [0, 50]) {
    const u = new URL(YANDEX_SEARCH);
    u.searchParams.set("apikey", apikey);
    u.searchParams.set("text", text);
    u.searchParams.set("type", "biz");
    u.searchParams.set("lang", "ru_RU");
    u.searchParams.set("results", "50");
    u.searchParams.set("skip", String(skip));
    u.searchParams.set("ll", `${lon},${lat}`);
    u.searchParams.set("spn", "0.45,0.35");
    u.searchParams.set("rspn", "1");

    const r = await fetch(u.toString(), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) break;

    const j = (await r.json()) as {
      features?: {
        geometry?: { coordinates?: number[] };
        properties?: {
          name?: string;
          description?: string;
          uri?: string;
          CompanyMetaData?: {
            id?: string;
            name?: string;
            address?: string;
            Address?: { formatted?: string };
            Categories?: { name?: string }[];
          };
        };
      }[];
    };

    const features = j.features || [];
    if (!features.length) break;

    for (const f of features) {
      const geom = f.geometry?.coordinates;
      const lon2 = Array.isArray(geom) ? geom[0] : null;
      const lat2 = Array.isArray(geom) ? geom[1] : null;
      const cm = f.properties?.CompanyMetaData;
      const name = f.properties?.name || cm?.name || "";
      const addr = cm?.Address?.formatted || cm?.address || f.properties?.description || "";
      const id = cm?.id || f.properties?.uri || `${name}-${addr}`.slice(0, 120);
      const cat = cm?.Categories?.[0]?.name || "";

      out.push({
        source: "yandex",
        externalId: String(id),
        name: String(name).trim() || "Без названия",
        address: String(addr).trim() || city,
        city,
        latitude: typeof lat2 === "number" ? lat2 : null,
        longitude: typeof lon2 === "number" ? lon2 : null,
        category: cat
      });
    }

    if (features.length < 50) break;
  }

  return dedupeByExternalId(out);
}

export async function searchMapsCombined(city: string, query: string): Promise<{
  dgis: MapDirectoryHit[];
  yandex: MapDirectoryHit[];
  items: MapDirectoryHit[];
  configured: ReturnType<typeof mapsKeysConfigured>;
}> {
  const configured = mapsKeysConfigured();
  const [dgis, yandex] = await Promise.all([
    configured.dgis ? search2gis(city, query).catch(() => []) : Promise.resolve([]),
    configured.yandex ? searchYandex(city, query).catch(() => []) : Promise.resolve([])
  ]);
  const items = dedupeByExternalId([...dgis, ...yandex]);
  return { dgis, yandex, items, configured };
}
