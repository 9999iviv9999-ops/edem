import type { Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { mapsKeysConfigured, searchMapsCombined } from "../services/mapsDirectory";

const createGymSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  okrug: z.string().optional(),
  district: z.string().optional(),
  region: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  externalProvider: z.enum(["yandex", "dgis", "other"]).optional(),
  externalId: z.string().optional(),
  chainName: z.string().optional()
});

export const gymsRouter = Router();

type GeneratedGym = {
  name: string;
  address: string;
  city: string;
  okrug?: string;
  district?: string;
  region?: string;
  chainName?: string;
  externalProvider: "other";
  externalId: string;
};

let generatedGymsByCity: Map<string, GeneratedGym[]> | null = null;

function norm(s?: string | null): string {
  return (s || "").trim().toLowerCase();
}

function loadGeneratedGymsByCity(): Map<string, GeneratedGym[]> {
  if (generatedGymsByCity) return generatedGymsByCity;
  const p = join(process.cwd(), "prisma", "gyms-generated.json");
  if (!existsSync(p)) {
    generatedGymsByCity = new Map();
    return generatedGymsByCity;
  }
  const rows = JSON.parse(readFileSync(p, "utf8")) as GeneratedGym[];
  const byCity = new Map<string, GeneratedGym[]>();
  for (const g of rows) {
    const key = norm(g.city);
    if (!key) continue;
    const arr = byCity.get(key) || [];
    arr.push(g);
    byCity.set(key, arr);
  }
  generatedGymsByCity = byCity;
  return byCity;
}

async function backfillGymsFromGeneratedCatalog(filters: {
  city?: string;
  okrug?: string;
  district?: string;
  region?: string;
  chainName?: string;
}): Promise<number> {
  const cityKey = norm(filters.city);
  if (!cityKey) return 0;
  const byCity = loadGeneratedGymsByCity();
  const candidates = byCity.get(cityKey) || [];
  if (!candidates.length) return 0;

  const okrugQ = norm(filters.okrug);
  const districtQ = norm(filters.district);
  const regionQ = norm(filters.region);
  const chainQ = norm(filters.chainName);

  const rows = candidates.filter((g) => {
    if (okrugQ && norm(g.okrug) !== okrugQ) return false;
    if (districtQ && !norm(g.district).includes(districtQ)) return false;
    if (regionQ && !norm(g.region).includes(regionQ)) return false;
    if (chainQ && !norm(g.chainName).includes(chainQ)) return false;
    return true;
  });
  if (!rows.length) return 0;

  const res = await prisma.gym.createMany({
    data: rows.map((g) => ({
      name: g.name,
      address: g.address,
      city: g.city,
      okrug: g.okrug ?? null,
      district: g.district ?? null,
      region: g.region ?? null,
      chainName: g.chainName ?? null,
      externalProvider: g.externalProvider,
      externalId: g.externalId
    })),
    skipDuplicates: true
  });
  return res.count;
}

gymsRouter.post("/", async (req, res, next) => {
  try {
    const data = createGymSchema.parse(req.body);

    if (data.externalProvider && data.externalId) {
      const existing = await prisma.gym.findFirst({
        where: {
          externalProvider: data.externalProvider,
          externalId: data.externalId
        }
      });
      if (existing) return res.json(existing);
    }

    const gym = await prisma.gym.create({ data });
    return res.status(201).json(gym);
  } catch (err) {
    return next(err);
  }
});

gymsRouter.get("/", async (req, res, next) => {
  try {
    const querySchema = z.object({
      city: z.string().optional(),
      okrug: z.string().optional(),
      district: z.string().optional(),
      region: z.string().optional(),
      chainName: z.string().optional(),
      q: z.string().optional(),
      /** Макс. число строк (по умолчанию без лимита при фильтре по городу). */
      limit: z.coerce.number().int().min(1).max(100000).optional()
    });
    const q = querySchema.parse(req.query);

    const where: Prisma.GymWhereInput = {};

    /** Без mode: insensitive — для кириллицы в PostgreSQL LOWER/ILIKE иногда даёт нулевую выборку при несовпадении локали. */
    if (q.city?.trim()) {
      where.city = q.city.trim();
    }
    if (q.okrug?.trim()) {
      where.okrug = q.okrug.trim();
    }
    if (q.district?.trim()) {
      where.district = { contains: q.district.trim() };
    }
    if (q.region?.trim()) {
      where.region = { contains: q.region.trim() };
    }
    if (q.chainName?.trim()) {
      where.chainName = { contains: q.chainName.trim() };
    }
    if (q.q?.trim()) {
      where.OR = [
        { name: { contains: q.q.trim() } },
        { address: { contains: q.q.trim() } }
      ];
    }

    const hasCity = Boolean(q.city?.trim());
    const hasQ = Boolean(q.q?.trim());
    let take: number | undefined;
    if (q.limit != null) {
      take = q.limit;
    } else if (hasCity) {
      take = undefined;
    } else if (hasQ) {
      take = 800;
    } else {
      take = 200;
    }

    let gyms = await prisma.gym.findMany({
      where,
      orderBy: [{ city: "asc" }, { name: "asc" }],
      ...(take !== undefined ? { take } : {})
    });

    if (gyms.length === 0 && q.city?.trim()) {
      await backfillGymsFromGeneratedCatalog({
        city: q.city,
        okrug: q.okrug,
        district: q.district,
        region: q.region,
        chainName: q.chainName
      });
      gyms = await prisma.gym.findMany({
        where,
        orderBy: [{ city: "asc" }, { name: "asc" }],
        ...(take !== undefined ? { take } : {})
      });
    }

    return res.json(gyms);
  } catch (err) {
    return next(err);
  }
});

const gymSuggestionSchema = z.object({
  city: z.string().min(1),
  okrug: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  details: z.string().max(1000).optional()
});

gymsRouter.post("/suggestions", requireAuth, async (req, res, next) => {
  try {
    const body = gymSuggestionSchema.parse(req.body);
    const row = await prisma.gymSuggestion.create({
      data: {
        userId: req.userId!,
        city: body.city.trim(),
        okrug: body.okrug?.trim() || null,
        district: body.district?.trim() || null,
        name: body.name.trim(),
        address: body.address.trim(),
        details: body.details?.trim() || null
      }
    });
    return res.status(201).json({ id: row.id, ok: true });
  } catch (err) {
    return next(err);
  }
});

gymsRouter.get("/maps/status", (_req, res) => {
  res.json(mapsKeysConfigured());
});

gymsRouter.get("/maps/search", requireAuth, async (req, res, next) => {
  try {
    const qs = z
      .object({
        city: z.string().min(1),
        q: z.string().optional()
      })
      .parse(req.query);

    const cfg = mapsKeysConfigured();
    if (!cfg.dgis && !cfg.yandex) {
      return res.status(503).json({
        error: "Не заданы ключи DGIS_API_KEY и/или YANDEX_MAPS_API_KEY",
        configured: cfg
      });
    }

    const result = await searchMapsCombined(qs.city.trim(), qs.q?.trim() || "");
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

const importFromMapSchema = z.object({
  provider: z.enum(["dgis", "yandex"]),
  externalId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  district: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  category: z.string().optional()
});

gymsRouter.post("/import-from-map", requireAuth, async (req, res, next) => {
  try {
    const data = importFromMapSchema.parse(req.body);
    const externalProvider = data.provider;

    const existing = await prisma.gym.findFirst({
      where: { externalProvider, externalId: data.externalId }
    });
    if (existing) return res.json(existing);

    const gym = await prisma.gym.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        okrug: null,
        district: data.district || null,
        region: null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        externalProvider,
        externalId: data.externalId,
        chainName: data.category?.trim() || (data.provider === "dgis" ? "2ГИС" : "Яндекс.Карты")
      }
    });
    return res.status(201).json(gym);
  } catch (err) {
    return next(err);
  }
});

gymsRouter.get("/:gymId", async (req, res, next) => {
  try {
    const gym = await prisma.gym.findUnique({
      where: { id: req.params.gymId }
    });
    if (!gym) return res.status(404).json({ error: "Gym not found" });
    return res.json(gym);
  } catch (err) {
    return next(err);
  }
});
