import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createGymSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  region: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  externalProvider: z.enum(["yandex", "dgis", "other"]).optional(),
  externalId: z.string().optional(),
  chainName: z.string().optional()
});

export const gymsRouter = Router();

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
      region: z.string().optional(),
      chainName: z.string().optional(),
      q: z.string().optional()
    });
    const q = querySchema.parse(req.query);

    const gyms = await prisma.gym.findMany({
      where: {
        city: q.city
          ? {
              contains: q.city,
              mode: "insensitive"
            }
          : undefined,
        region: q.region
          ? {
              contains: q.region,
              mode: "insensitive"
            }
          : undefined,
        chainName: q.chainName
          ? {
              contains: q.chainName,
              mode: "insensitive"
            }
          : undefined,
        OR: q.q
          ? [
              { name: { contains: q.q, mode: "insensitive" } },
              { address: { contains: q.q, mode: "insensitive" } }
            ]
          : undefined
      },
      take: 100
    });

    return res.json(gyms);
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
