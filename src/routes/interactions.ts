import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const likeSchema = z.object({
  toUserId: z.string().min(1),
  gymId: z.string().min(1)
});

const messageSchema = z.object({
  matchId: z.string().min(1),
  text: z.string().min(1).max(1000)
});

export const interactionsRouter = Router();

interactionsRouter.post("/likes", requireAuth, async (req, res, next) => {
  try {
    const data = likeSchema.parse(req.body);
    if (data.toUserId === req.userId) {
      return res.status(400).json({ error: "Cannot like yourself" });
    }

    const blocking = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId!, blockedId: data.toUserId },
          { blockerId: data.toUserId, blockedId: req.userId! }
        ]
      }
    });
    if (blocking) {
      return res.status(403).json({ error: "Interaction unavailable due to block" });
    }

    const [fromMembership, toMembership] = await Promise.all([
      prisma.userGymMembership.findFirst({
        where: { userId: req.userId!, gymId: data.gymId }
      }),
      prisma.userGymMembership.findFirst({
        where: { userId: data.toUserId, gymId: data.gymId }
      })
    ]);

    if (!fromMembership || !toMembership) {
      return res.status(400).json({ error: "Users must be in selected gym" });
    }

    const like = await prisma.like.upsert({
      where: {
        fromUserId_toUserId_gymId: {
          fromUserId: req.userId!,
          toUserId: data.toUserId,
          gymId: data.gymId
        }
      },
      update: {},
      create: {
        fromUserId: req.userId!,
        toUserId: data.toUserId,
        gymId: data.gymId
      }
    });

    const reverseLike = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId_gymId: {
          fromUserId: data.toUserId,
          toUserId: req.userId!,
          gymId: data.gymId
        }
      }
    });

    let match = null;
    if (reverseLike) {
      const userAId = [req.userId!, data.toUserId].sort()[0];
      const userBId = [req.userId!, data.toUserId].sort()[1];

      match = await prisma.match.upsert({
        where: {
          userAId_userBId_gymId: {
            userAId,
            userBId,
            gymId: data.gymId
          }
        },
        update: {},
        create: {
          userAId,
          userBId,
          gymId: data.gymId
        }
      });
    }

    return res.status(201).json({ like, match });
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.get("/matches", requireAuth, async (req, res, next) => {
  try {
    const data = await prisma.match.findMany({
      where: {
        OR: [{ userAId: req.userId! }, { userBId: req.userId! }]
      },
      include: {
        gym: true,
        userA: { select: { id: true, name: true, photos: true } },
        userB: { select: { id: true, name: true, photos: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    const blocks = await prisma.block.findMany({
      where: {
        OR: [{ blockerId: req.userId! }, { blockedId: req.userId! }]
      },
      select: { blockerId: true, blockedId: true }
    });
    const blockedUserIds = new Set<string>();
    for (const b of blocks) {
      blockedUserIds.add(b.blockerId === req.userId ? b.blockedId : b.blockerId);
    }

    const filtered = data.filter(
      (m) => !blockedUserIds.has(m.userAId) && !blockedUserIds.has(m.userBId)
    );

    return res.json(filtered);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/messages", requireAuth, async (req, res, next) => {
  try {
    const data = messageSchema.parse(req.body);
    const match = await prisma.match.findUnique({ where: { id: data.matchId } });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const allowed = match.userAId === req.userId || match.userBId === req.userId;
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
    const otherUserId = match.userAId === req.userId ? match.userBId : match.userAId;
    const blocking = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId!, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: req.userId! }
        ]
      }
    });
    if (blocking) {
      return res.status(403).json({ error: "Chat unavailable due to block" });
    }

    const message = await prisma.message.create({
      data: {
        matchId: data.matchId,
        fromUserId: req.userId!,
        text: data.text
      }
    });

    return res.status(201).json(message);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.get("/messages/:matchId", requireAuth, async (req, res, next) => {
  try {
    const match = await prisma.match.findUnique({ where: { id: req.params.matchId } });
    if (!match) return res.status(404).json({ error: "Match not found" });

    const allowed = match.userAId === req.userId || match.userBId === req.userId;
    if (!allowed) return res.status(403).json({ error: "Forbidden" });
    const otherUserId = match.userAId === req.userId ? match.userBId : match.userAId;
    const blocking = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: req.userId!, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: req.userId! }
        ]
      }
    });
    if (blocking) {
      return res.status(403).json({ error: "Chat unavailable due to block" });
    }

    const messages = await prisma.message.findMany({
      where: { matchId: req.params.matchId },
      orderBy: { createdAt: "asc" },
      take: 300
    });

    return res.json(messages);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/blocks", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ blockedUserId: z.string().min(1) });
    const data = schema.parse(req.body);
    if (data.blockedUserId === req.userId) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }
    const block = await prisma.block.upsert({
      where: {
        blockerId_blockedId: {
          blockerId: req.userId!,
          blockedId: data.blockedUserId
        }
      },
      update: {},
      create: {
        blockerId: req.userId!,
        blockedId: data.blockedUserId
      }
    });
    return res.status(201).json(block);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.delete("/blocks/:blockedUserId", requireAuth, async (req, res, next) => {
  try {
    await prisma.block.deleteMany({
      where: {
        blockerId: req.userId!,
        blockedId: req.params.blockedUserId
      }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/reports", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      reportedUserId: z.string().min(1),
      reason: z.string().min(3).max(120),
      details: z.string().max(1000).optional()
    });
    const data = schema.parse(req.body);
    if (data.reportedUserId === req.userId) {
      return res.status(400).json({ error: "Cannot report yourself" });
    }
    const report = await prisma.report.create({
      data: {
        reporterId: req.userId!,
        reportedId: data.reportedUserId,
        reason: data.reason,
        details: data.details
      }
    });
    return res.status(201).json(report);
  } catch (err) {
    return next(err);
  }
});
