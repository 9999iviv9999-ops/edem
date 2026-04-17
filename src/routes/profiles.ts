import { Router } from "express";
import { Goal, TrainingTimeSlot, TrainingType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const updateProfileSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(18).max(80),
  gender: z.enum(["male", "female", "other"]),
  city: z.string().min(1),
  okrug: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  photos: z.array(z.string().url()).max(6),
  mainGymId: z.string().min(1),
  extraGymIds: z.array(z.string()).max(4).default([]),
  goals: z.array(z.enum(["relationship", "communication", "workout_partner"])).min(1),
  trainingTimeSlots: z.array(z.enum(["morning", "day", "evening", "weekends"])).min(1),
  trainingTypes: z.array(z.enum(["strength", "cardio", "crossfit", "yoga"])).min(1)
});

const patchLocationSchema = z.object({
  city: z.string().min(1),
  okrug: z.string().max(200).optional().default(""),
  district: z.string().max(200).optional().default("")
});

const patchPrimaryGymSchema = z.object({
  gymId: z.string().min(1)
});

const filterSchema = z.object({
  minAge: z.coerce.number().int().optional(),
  maxAge: z.coerce.number().int().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  goals: z.string().optional(),
  trainingTimeSlots: z.string().optional()
});

export const profilesRouter = Router();

profilesRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: {
        memberships: { include: { gym: true } },
        goals: true,
        trainingSlots: true,
        trainingTypes: true
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (err) {
    return next(err);
  }
});

/** Частичное обновление города / округа / района (лента и т.п. без полного PUT профиля). */
profilesRouter.patch("/me/location", requireAuth, async (req, res, next) => {
  try {
    const data = patchLocationSchema.parse(req.body);
    const okrug = data.okrug.trim() ? data.okrug.trim() : null;
    const district = data.district.trim() ? data.district.trim() : null;

    const prev = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { city: true }
    });
    if (!prev) return res.status(404).json({ error: "User not found" });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId! },
        data: { city: data.city, okrug, district }
      });
      if (prev.city !== data.city) {
        await tx.userGymMembership.deleteMany({
          where: {
            userId: req.userId!,
            gym: { city: { not: data.city } }
          }
        });
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

/** Основной зал из ленты: тот же членство, что в профиле, без полного PUT. */
profilesRouter.patch("/me/primary-gym", requireAuth, async (req, res, next) => {
  try {
    const { gymId } = patchPrimaryGymSchema.parse(req.body);
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return res.status(400).json({ error: "Gym not found" });

    await prisma.$transaction(async (tx) => {
      await tx.userGymMembership.updateMany({
        where: { userId: req.userId! },
        data: { isPrimary: false }
      });
      await tx.userGymMembership.upsert({
        where: {
          userId_gymId: { userId: req.userId!, gymId }
        },
        create: {
          userId: req.userId!,
          gymId,
          isPrimary: true
        },
        update: { isPrimary: true }
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

profilesRouter.put("/me", requireAuth, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const gymIds = [data.mainGymId, ...data.extraGymIds];
    const gymsCount = await prisma.gym.count({ where: { id: { in: gymIds } } });
    if (gymsCount !== gymIds.length) {
      return res.status(400).json({ error: "Some gyms do not exist" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId! },
        data: {
          name: data.name,
          age: data.age,
          gender: data.gender,
          city: data.city,
          okrug: data.okrug,
          district: data.district,
          description: data.description,
          photos: data.photos
        }
      });

      await tx.userGymMembership.deleteMany({ where: { userId: req.userId! } });
      await tx.userGoal.deleteMany({ where: { userId: req.userId! } });
      await tx.userTrainingSlot.deleteMany({ where: { userId: req.userId! } });
      await tx.userTrainingType.deleteMany({ where: { userId: req.userId! } });

      await tx.userGymMembership.create({
        data: {
          userId: req.userId!,
          gymId: data.mainGymId,
          isPrimary: true
        }
      });

      if (data.extraGymIds.length > 0) {
        await tx.userGymMembership.createMany({
          data: data.extraGymIds.map((gymId) => ({
            userId: req.userId!,
            gymId,
            isPrimary: false
          }))
        });
      }

      await tx.userGoal.createMany({
        data: data.goals.map((goal) => ({
          userId: req.userId!,
          goal: goal as Goal
        }))
      });

      await tx.userTrainingSlot.createMany({
        data: data.trainingTimeSlots.map((slot) => ({
          userId: req.userId!,
          slot: slot as TrainingTimeSlot
        }))
      });

      await tx.userTrainingType.createMany({
        data: data.trainingTypes.map((type) => ({
          userId: req.userId!,
          type: type as TrainingType
        }))
      });
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

profilesRouter.get("/gyms/:gymId", requireAuth, async (req, res, next) => {
  try {
    const gymId = req.params.gymId;
    const filters = filterSchema.parse(req.query);
    const goals = filters.goals?.split(",") as Goal[] | undefined;
    const slots = filters.trainingTimeSlots?.split(",") as TrainingTimeSlot[] | undefined;

    const profiles = await prisma.user.findMany({
      where: {
        id: { not: req.userId! },
        age: {
          gte: filters.minAge,
          lte: filters.maxAge
        },
        gender: filters.gender,
        memberships: {
          some: {
            gymId
          }
        },
        blocksInitiated: {
          none: { blockedId: req.userId! }
        },
        blocksReceived: {
          none: { blockerId: req.userId! }
        },
        goals: goals?.length
          ? {
              some: { goal: { in: goals } }
            }
          : undefined,
        trainingSlots: slots?.length
          ? {
              some: { slot: { in: slots } }
            }
          : undefined
      },
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        description: true,
        photos: true,
        city: true,
        isVerified: true,
        goals: true,
        trainingSlots: true,
        trainingTypes: true
      },
      take: 100
    });

    return res.json(profiles);
  } catch (err) {
    return next(err);
  }
});
