import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireModerationKey } from "../middleware/moderation-auth";

export const moderationRouter = Router();

moderationRouter.use(requireModerationKey);

moderationRouter.get("/reports", async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.string().optional(),
      take: z.coerce.number().int().min(1).max(200).default(50)
    });
    const q = schema.parse(req.query);

    const reports = await prisma.report.findMany({
      where: {
        status: q.status
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        reported: { select: { id: true, name: true, email: true, isBanned: true } }
      },
      orderBy: { createdAt: "desc" },
      take: q.take
    });
    return res.json(reports);
  } catch (err) {
    return next(err);
  }
});

moderationRouter.patch("/reports/:reportId", async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(["open", "in_review", "resolved", "dismissed"])
    });
    const data = schema.parse(req.body);
    const report = await prisma.report.update({
      where: { id: req.params.reportId },
      data: {
        status: data.status,
        reviewedAt: new Date()
      }
    });
    return res.json(report);
  } catch (err) {
    return next(err);
  }
});

moderationRouter.patch("/users/:userId/ban", async (req, res, next) => {
  try {
    const schema = z.object({
      isBanned: z.boolean(),
      reason: z.string().max(500).optional()
    });
    const data = schema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: {
        isBanned: data.isBanned,
        banReason: data.isBanned ? data.reason ?? "Moderation action" : null
      }
    });
    if (data.isBanned) {
      await prisma.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }
    return res.json({
      id: user.id,
      isBanned: user.isBanned,
      banReason: user.banReason
    });
  } catch (err) {
    return next(err);
  }
});
