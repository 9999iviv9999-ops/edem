import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireAuth } from "../middleware/auth";

export const moderationRouter = Router();

moderationRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
moderationRouter.use(requireAuth, requireAdmin);

async function logAdminAction(params: {
  adminUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: params.adminUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload ? JSON.stringify(params.payload) : null
    }
  });
}

function splitNameAddress(line: string): { name: string; address: string } | null {
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;
  const parts = raw.split(/\s+[—-]\s+|;\s*/).map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { name: parts[0], address: parts.slice(1).join(", ") };
}

const catalogImportSchema = z.object({
  city: z.string().min(1),
  okrug: z.string().optional(),
  district: z.string().optional(),
  region: z.string().optional(),
  chainName: z.string().optional(),
  replaceScope: z.boolean().optional().default(false),
  lines: z.array(z.string()).min(1)
});

moderationRouter.post("/catalog/import-list", async (req, res, next) => {
  try {
    const data = catalogImportSchema.parse(req.body);
    const city = data.city.trim();
    const okrug = data.okrug?.trim() || null;
    const district = data.district?.trim() || null;
    const region = data.region?.trim() || null;
    const chainName = data.chainName?.trim() || null;

    const parsed = data.lines
      .map((line) => splitNameAddress(line))
      .filter((x): x is { name: string; address: string } => Boolean(x));

    if (!parsed.length) {
      return res.status(400).json({ error: "No valid lines. Use format: Название — Адрес" });
    }

    let deleted = 0;
    if (data.replaceScope) {
      const del = await prisma.gym.deleteMany({
        where: {
          city,
          ...(okrug ? { okrug } : {}),
          ...(district ? { district } : {})
        }
      });
      deleted = del.count;
    }

    const rows = parsed.map((p) => ({
      name: p.name,
      address: p.address,
      city,
      okrug,
      district,
      region,
      chainName,
      externalProvider: "other" as const,
      externalId: `ui-${city}-${okrug || ""}-${district || ""}-${p.name}-${p.address}`
        .toLowerCase()
        .replace(/\s+/g, "-")
        .slice(0, 190)
    }));

    const created = await prisma.gym.createMany({ data: rows, skipDuplicates: true });
    await logAdminAction({
      adminUserId: req.userId!,
      action: "catalog_import_list",
      entityType: "gym_catalog",
      entityId: city,
      payload: { parsed: parsed.length, inserted: created.count, deleted, city, okrug, district }
    });
    return res.json({
      ok: true,
      parsed: parsed.length,
      inserted: created.count,
      deleted
    });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/reports", async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50)
    });
    const q = schema.parse(req.query);
    const skip = (q.page - 1) * q.pageSize;

    const where = { status: q.status };
    const [items, total] = await prisma.$transaction([
      prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          reported: { select: { id: true, name: true, email: true, isBanned: true } }
        },
        orderBy: { createdAt: "desc" },
        take: q.pageSize,
        skip
      }),
      prisma.report.count({ where })
    ]);
    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
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
    await logAdminAction({
      adminUserId: req.userId!,
      action: "report_status_update",
      entityType: "report",
      entityId: report.id,
      payload: { status: report.status }
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
    await logAdminAction({
      adminUserId: req.userId!,
      action: data.isBanned ? "user_ban" : "user_unban",
      entityType: "user",
      entityId: user.id,
      payload: { isBanned: user.isBanned, reason: user.banReason }
    });
    return res.json({
      id: user.id,
      isBanned: user.isBanned,
      banReason: user.banReason
    });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/users", async (req, res, next) => {
  try {
    const schema = z.object({
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50)
    });
    const q = schema.parse(req.query);
    const term = q.q?.trim();
    const skip = (q.page - 1) * q.pageSize;
    const where = term
      ? {
          OR: [{ name: { contains: term } }, { email: { contains: term } }, { phone: { contains: term } }]
        }
      : undefined;

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          isBanned: true,
          banReason: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" },
        take: q.pageSize,
        skip
      }),
      prisma.user.count({ where })
    ]);

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/gyms", async (req, res, next) => {
  try {
    const schema = z.object({
      city: z.string().optional(),
      q: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(100)
    });
    const q = schema.parse(req.query);
    const skip = (q.page - 1) * q.pageSize;

    const where: Record<string, unknown> = {};
    if (q.city?.trim()) where.city = q.city.trim();
    if (q.q?.trim()) {
      where.OR = [{ name: { contains: q.q.trim() } }, { address: { contains: q.q.trim() } }];
    }

    const [items, total] = await prisma.$transaction([
      prisma.gym.findMany({
        where,
        orderBy: [{ city: "asc" }, { name: "asc" }],
        take: q.pageSize,
        skip
      }),
      prisma.gym.count({ where })
    ]);

    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.patch("/gyms/:gymId", async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1).max(200),
      address: z.string().min(1).max(500),
      city: z.string().min(1).max(200),
      chainName: z.string().max(200).nullable().optional()
    });
    const data = schema.parse(req.body);

    const gym = await prisma.gym.update({
      where: { id: req.params.gymId },
      data: {
        name: data.name.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        chainName: data.chainName?.trim() || null
      }
    });
    await logAdminAction({
      adminUserId: req.userId!,
      action: "gym_update",
      entityType: "gym",
      entityId: gym.id,
      payload: { name: gym.name, address: gym.address, city: gym.city, chainName: gym.chainName }
    });

    return res.json(gym);
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/audit-logs", async (req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(50)
    });
    const q = schema.parse(req.query);
    const skip = (q.page - 1) * q.pageSize;
    const [items, total] = await prisma.$transaction([
      prisma.adminAuditLog.findMany({
        include: { adminUser: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: q.pageSize
      }),
      prisma.adminAuditLog.count()
    ]);
    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/profile-comments", async (req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(200).default(20)
    });
    const q = schema.parse(req.query);
    const skip = (q.page - 1) * q.pageSize;
    const [items, total] = await prisma.$transaction([
      prisma.profileComment.findMany({
        include: {
          author: { select: { id: true, name: true, email: true } },
          targetUser: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: q.pageSize
      }),
      prisma.profileComment.count()
    ]);
    return res.json({ items, total, page: q.page, pageSize: q.pageSize });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.delete("/profile-comments/:commentId", async (req, res, next) => {
  try {
    const existing = await prisma.profileComment.findUnique({
      where: { id: req.params.commentId },
      select: { id: true, text: true, authorId: true, targetUserId: true }
    });
    if (!existing) return res.status(404).json({ error: "Comment not found" });
    await prisma.profileComment.delete({ where: { id: existing.id } });
    await logAdminAction({
      adminUserId: req.userId!,
      action: "profile_comment_delete",
      entityType: "profile_comment",
      entityId: existing.id,
      payload: {
        authorId: existing.authorId,
        targetUserId: existing.targetUserId,
        text: existing.text
      }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

moderationRouter.get("/stats", async (_req, res, next) => {
  try {
    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [registrationsToday, active24h, openReports, totalUsers] = await prisma.$transaction([
      prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
      prisma.refreshSession.count({
        where: {
          createdAt: { gte: since24h },
          revokedAt: null
        }
      }),
      prisma.report.count({ where: { status: { in: ["open", "in_review"] } } }),
      prisma.user.count()
    ]);

    return res.json({
      registrationsToday,
      active24h,
      openReports,
      totalUsers
    });
  } catch (err) {
    return next(err);
  }
});
