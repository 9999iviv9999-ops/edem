import { Router } from "express";
import { Goal, TrainingTimeSlot, TrainingType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const photoUrlSchema = z
  .string()
  .trim()
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith("/uploads/"), {
    message: "Photo must be an absolute URL or local /uploads path"
  });

const updateProfileSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(18).max(80),
  gender: z.enum(["male", "female", "other"]),
  city: z.string().min(1),
  okrug: z.string().max(200).optional(),
  district: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  photos: z.array(photoUrlSchema).max(6),
  mainGymId: z.string().optional().default(""),
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
const patchBasicProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
  primaryGymId: z.string().trim().min(1).optional()
});

const patchPhotosSchema = z.object({
  photos: z.array(photoUrlSchema).max(6)
});

const filterSchema = z.object({
  minAge: z.coerce.number().int().optional(),
  maxAge: z.coerce.number().int().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  goals: z.string().optional(),
  trainingTimeSlots: z.string().optional()
});
const createProfileCommentSchema = z.object({
  text: z.string().trim().min(1).max(400)
});

export const profilesRouter = Router();

profilesRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

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

/** Легкое обновление базового профиля для mobile без полной анкеты. */
profilesRouter.patch("/me/basic", requireAuth, async (req, res, next) => {
  try {
    const data = patchBasicProfileSchema.parse(req.body);
    const description = data.description ? data.description : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: req.userId! },
        data: {
          name: data.name,
          city: data.city,
          description
        }
      });

      if (data.primaryGymId) {
        const gym = await tx.gym.findUnique({ where: { id: data.primaryGymId } });
        if (!gym) {
          throw new Error("Gym not found");
        }
        await tx.userGymMembership.updateMany({
          where: { userId: req.userId! },
          data: { isPrimary: false }
        });
        await tx.userGymMembership.upsert({
          where: {
            userId_gymId: { userId: req.userId!, gymId: data.primaryGymId }
          },
          create: {
            userId: req.userId!,
            gymId: data.primaryGymId,
            isPrimary: true
          },
          update: { isPrimary: true }
        });
      }
    });

    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Gym not found") {
      return res.status(400).json({ error: "Gym not found" });
    }
    return next(err);
  }
});

/** Список фото профиля (мобильное приложение после upload в /api/media/upload-photo). */
profilesRouter.patch("/me/photos", requireAuth, async (req, res, next) => {
  try {
    const data = patchPhotosSchema.parse(req.body);
    await prisma.user.update({
      where: { id: req.userId! },
      data: { photos: data.photos }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

profilesRouter.put("/me", requireAuth, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const gymIds = data.mainGymId ? [data.mainGymId, ...data.extraGymIds] : [...data.extraGymIds];
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

      if (data.mainGymId) {
        await tx.userGymMembership.create({
          data: {
            userId: req.userId!,
            gymId: data.mainGymId,
            isPrimary: true
          }
        });
      }

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

profilesRouter.get("/:userId", requireAuth, async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        age: true,
        gender: true,
        description: true,
        photos: true,
        city: true,
        isVerified: true,
        memberships: {
          select: {
            isPrimary: true,
            gym: { select: { id: true, name: true, city: true } }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const comments = await prisma.profileComment.findMany({
      where: { targetUserId: userId },
      include: {
        author: {
          select: { id: true, name: true, photos: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return res.json({
      profile: user,
      comments
    });
  } catch (err) {
    return next(err);
  }
});

profilesRouter.post("/:userId/comments", requireAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const body = createProfileCommentSchema.parse(req.body);
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: "Cannot comment your own profile" });
    }
    const targetExists = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true }
    });
    if (!targetExists) {
      return res.status(404).json({ error: "User not found" });
    }

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId!, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: req.userId! }
        ]
      }
    });
    if (blocked) {
      return res.status(403).json({ error: "Comment unavailable due to block" });
    }

    const comment = await prisma.profileComment.create({
      data: {
        authorId: req.userId!,
        targetUserId,
        text: body.text
      },
      include: {
        author: {
          select: { id: true, name: true, photos: true }
        }
      }
    });
    return res.status(201).json(comment);
  } catch (err) {
    return next(err);
  }
});

profilesRouter.delete("/comments/:commentId", requireAuth, async (req, res, next) => {
  try {
    const comment = await prisma.profileComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, authorId: true }
    });
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.authorId !== req.userId) {
      return res.status(403).json({ error: "You can delete only your own comment" });
    }
    await prisma.profileComment.delete({ where: { id: comment.id } });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

profilesRouter.post("/comments/:commentId/report", requireAuth, async (req, res, next) => {
  try {
    const comment = await prisma.profileComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, authorId: true, targetUserId: true, text: true }
    });
    if (!comment) return res.status(404).json({ error: "Comment not found" });
    if (comment.authorId === req.userId) {
      return res.status(400).json({ error: "Cannot report your own comment" });
    }

    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId!, blockedId: comment.authorId },
          { blockerId: comment.authorId, blockedId: req.userId! }
        ]
      }
    });
    if (blocked) {
      return res.status(403).json({ error: "Comment unavailable due to block" });
    }

    const details = JSON.stringify({
      source: "profile_comment",
      commentId: comment.id,
      targetUserId: comment.targetUserId
    });
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: req.userId!,
        reportedId: comment.authorId,
        reason: "comment_abuse",
        details
      },
      select: { id: true }
    });
    if (existing) return res.json({ ok: true, duplicate: true });

    await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reportedId: comment.authorId,
        reason: "comment_abuse",
        details
      }
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
