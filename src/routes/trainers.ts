import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const trainersQuerySchema = z.object({
  city: z.string().trim().max(120).optional(),
  gymId: z.string().trim().max(60).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export const trainersRouter = Router();

trainersRouter.get("/", async (req, res, next) => {
  try {
    const query = trainersQuerySchema.parse(req.query);
    const where = {
      isTrainer: true,
      trainerVisible: true,
      ...(query.city ? { city: query.city } : {}),
      ...(query.gymId
        ? {
            memberships: {
              some: { gymId: query.gymId }
            }
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q } },
              { trainerHeadline: { contains: query.q } },
              { trainerBio: { contains: query.q } },
              { trainerSpecializations: { has: query.q } }
            ]
          }
        : {})
    } as const;

    const rows = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        age: true,
        city: true,
        photos: true,
        profileBadge: true,
        trainerHeadline: true,
        trainerBio: true,
        trainerExperienceYears: true,
        trainerSpecializations: true,
        trainerFormats: true,
        trainerPriceFrom: true,
        trainerContacts: true,
        memberships: {
          select: {
            isPrimary: true,
            gym: { select: { id: true, name: true, city: true, chainName: true } }
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }],
      take: query.limit ?? 80
    });

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

