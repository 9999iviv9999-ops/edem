import type { Match } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { createRequestThrottle } from "../middleware/request-throttle";
import { evaluateAutoBanForReportedUser } from "../services/auto-moderation";
import { zCuid } from "../lib/validation";
import { notifyUserDevices } from "../lib/push-notify";
import { isAllowedMessageAttachmentUrl } from "../lib/chat-attachments";

const likeSchema = z.object({
  toUserId: zCuid,
  gymId: zCuid
});

const startChatSchema = z.object({
  toUserId: zCuid,
  gymId: zCuid
});
const typingSchema = z.object({
  matchId: zCuid,
  isTyping: z.boolean()
});

export const interactionsRouter = Router();
const typingState = new Map<string, Map<string, number>>();
const likesThrottle = createRequestThrottle({
  keyPrefix: "likes",
  windowMs: 60 * 1000,
  max: 30,
  errorMessage: "Too many likes. Please wait a minute."
});
const messagesThrottle = createRequestThrottle({
  keyPrefix: "messages",
  windowMs: 60 * 1000,
  max: 40,
  errorMessage: "Too many messages. Please wait a minute."
});
const reportsThrottle = createRequestThrottle({
  keyPrefix: "reports",
  windowMs: 10 * 60 * 1000,
  max: 5,
  errorMessage: "Too many reports from your account. Try again later."
});

function getTypingUsers(matchId: string, currentUserId: string) {
  const now = Date.now();
  const entry = typingState.get(matchId);
  if (!entry) return [];
  const active: string[] = [];
  for (const [userId, ts] of entry.entries()) {
    if (now - ts <= 6000 && userId !== currentUserId) {
      active.push(userId);
    }
  }
  if (active.length === 0) {
    typingState.delete(matchId);
  }
  return active;
}

async function ensureChatAccess(matchId: string, userId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return { error: { status: 404, body: { error: "Match not found" as const } } };
  }
  const allowed = match.userAId === userId || match.userBId === userId;
  if (!allowed) {
    return { error: { status: 403, body: { error: "Forbidden" as const } } };
  }
  const otherUserId = match.userAId === userId ? match.userBId : match.userAId;
  const blocking = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId }
      ]
    }
  });
  if (blocking) {
    return { error: { status: 403, body: { error: "Chat unavailable due to block" as const } } };
  }
  return { match, otherUserId };
}

async function createOrGetChat(userId: string, toUserId: string, gymId: string) {
  if (toUserId === userId) {
    return { error: { status: 400, body: { error: "Cannot message yourself" as const } } };
  }
  const blocking = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: toUserId },
        { blockerId: toUserId, blockedId: userId }
      ]
    }
  });
  if (blocking) {
    return { error: { status: 403, body: { error: "Chat unavailable due to block" as const } } };
  }

  const [fromMembership, toMembership] = await Promise.all([
    prisma.userGymMembership.findFirst({
      where: { userId, gymId }
    }),
    prisma.userGymMembership.findFirst({
      where: { userId: toUserId, gymId }
    })
  ]);

  if (!fromMembership || !toMembership) {
    return { error: { status: 400, body: { error: "Users must be in selected gym" as const } } };
  }

  const [userAId, userBId] = [userId, toUserId].sort();
  const match = await prisma.match.upsert({
    where: {
      userAId_userBId_gymId: { userAId, userBId, gymId }
    },
    update: {},
    create: {
      userAId,
      userBId,
      gymId
    }
  });

  return { match };
}

interactionsRouter.get("/likes/incoming", requireAuth, async (req, res, next) => {
  try {
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
    const blockedArr = Array.from(blockedUserIds);

    const rows = await prisma.like.findMany({
      where: {
        toUserId: req.userId!,
        ...(blockedArr.length ? { fromUserId: { notIn: blockedArr } } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        fromUser: {
          select: { id: true, name: true, age: true, photos: true, profileBadge: true }
        },
        gym: { select: { id: true, name: true, city: true } }
      }
    });

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/likes", requireAuth, likesThrottle, async (req, res, next) => {
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

    const existingLike = await prisma.like.findUnique({
      where: {
        fromUserId_toUserId_gymId: {
          fromUserId: req.userId!,
          toUserId: data.toUserId,
          gymId: data.gymId
        }
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

    let match: Match | null = null;
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

    if (existingLike) {
      return res.status(200).json({ like: existingLike, match, alreadyLiked: true });
    }

    const like = await prisma.like.create({
      data: {
        fromUserId: req.userId!,
        toUserId: data.toUserId,
        gymId: data.gymId
      }
    });

    const fromUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true }
    });
    const fromName = (fromUser?.name || "Кто-то").trim() || "Кто-то";

    if (reverseLike && match) {
      void notifyUserDevices(data.toUserId, {
        title: "Взаимный лайк",
        body: `${fromName} ответил(а) взаимностью — можно написать в чате.`,
        data: { type: "match", matchId: match.id }
      });
      void notifyUserDevices(req.userId!, {
        title: "Взаимный лайк",
        body: "У вас матч — загляни в чаты.",
        data: { type: "match", matchId: match.id }
      });
    } else {
      void notifyUserDevices(data.toUserId, {
        title: "Новый лайк",
        body: `${fromName} лайкнул(а) тебя.`,
        data: { type: "like" }
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
        userA: { select: { id: true, name: true, photos: true, profileBadge: true } },
        userB: { select: { id: true, name: true, photos: true, profileBadge: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            text: true,
            createdAt: true,
            fromUserId: true,
            readAt: true,
            attachmentUrl: true,
            attachmentMime: true,
            attachmentFilename: true,
            attachmentSize: true
          }
        }
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
    const matchIds = filtered.map((m) => m.id);
    const unreadRows =
      matchIds.length > 0
        ? await prisma.message.groupBy({
            by: ["matchId"],
            where: {
              matchId: { in: matchIds },
              fromUserId: { not: req.userId! },
              readAt: null
            },
            _count: { _all: true }
          })
        : [];
    const unreadMap = new Map(unreadRows.map((row) => [row.matchId, row._count._all]));
    const enriched = filtered
      .map((m) => ({
        ...m,
        unreadCount: unreadMap.get(m.id) ?? 0,
        lastActivityAt: m.messages[0]?.createdAt ?? m.createdAt
      }))
      .sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      );

    return res.json(enriched);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/messages/start", requireAuth, async (req, res, next) => {
  try {
    const data = startChatSchema.parse(req.body);
    const result = await createOrGetChat(req.userId!, data.toUserId, data.gymId);
    if ("error" in result && result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    return res.status(201).json(result.match);
  } catch (err) {
    return next(err);
  }
});

const CHAT_ATTACH_MAX = 12 * 1024 * 1024;

const postMessageSchema = z
  .object({
    text: z.string().max(1000).optional().default(""),
    matchId: z.string().min(1).optional(),
    toUserId: z.string().min(1).optional(),
    gymId: z.string().min(1).optional(),
    attachmentUrl: z.string().min(1).max(2000).optional(),
    attachmentMime: z.string().min(1).max(200).optional(),
    attachmentFilename: z.string().max(240).optional(),
    attachmentSize: z.number().int().min(0).max(CHAT_ATTACH_MAX).optional()
  })
  .superRefine((d, ctx) => {
    const t = (d.text ?? "").trim();
    const hasAtt = !!(d.attachmentUrl && d.attachmentUrl.trim());
    if (t.length === 0 && !hasAtt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "text or attachment required", path: ["text"] });
    }
    if (hasAtt && !(d.attachmentMime && d.attachmentMime.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attachmentMime required with attachment",
        path: ["attachmentMime"]
      });
    }
  });

interactionsRouter.post("/messages", requireAuth, messagesThrottle, async (req, res, next) => {
  try {
    const data = postMessageSchema.parse(req.body);

    let matchId = data.matchId;
    if (!matchId) {
      if (!data.toUserId || !data.gymId) {
        return res.status(400).json({ error: "matchId or (toUserId + gymId) required" });
      }
      const chat = await createOrGetChat(req.userId!, data.toUserId, data.gymId);
      if ("error" in chat && chat.error) {
        return res.status(chat.error.status).json(chat.error.body);
      }
      matchId = chat.match.id;
    }

    const access = await ensureChatAccess(matchId, req.userId!);
    if ("error" in access && access.error) {
      return res.status(access.error.status).json(access.error.body);
    }

    const trimmedText = (data.text ?? "").trim();
    const attUrl = data.attachmentUrl?.trim();
    if (attUrl) {
      if (!isAllowedMessageAttachmentUrl(req.userId!, attUrl)) {
        return res.status(400).json({ error: "Invalid attachment URL" });
      }
    }

    const message = await prisma.message.create({
      data: {
        matchId,
        fromUserId: req.userId!,
        text: trimmedText,
        ...(attUrl
          ? {
              attachmentUrl: attUrl,
              attachmentMime: data.attachmentMime!.trim(),
              attachmentFilename: data.attachmentFilename?.trim() || null,
              attachmentSize: typeof data.attachmentSize === "number" ? data.attachmentSize : null
            }
          : {
              attachmentUrl: null,
              attachmentMime: null,
              attachmentFilename: null,
              attachmentSize: null
            })
      }
    });

    const otherUserId = access.otherUserId;
    const fromUser = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { name: true }
    });
    const fname = data.attachmentFilename?.trim();
    const preview = attUrl
      ? trimmedText
        ? `${trimmedText.replace(/\s+/g, " ").slice(0, 80)} · ${fname ? `📎 ${fname}` : "📎"}`
        : fname
          ? `📎 ${fname}`
          : "📎 Вложение"
      : trimmedText.replace(/\s+/g, " ").slice(0, 120);
    const titleBase = (fromUser?.name || "").trim();
    void notifyUserDevices(otherUserId, {
      title: titleBase ? `Сообщение: ${titleBase}` : "Новое сообщение",
      body: preview || "Новое сообщение",
      data: { type: "message", matchId }
    });

    return res.status(201).json(message);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.patch("/messages/:messageId", requireAuth, messagesThrottle, async (req, res, next) => {
  try {
    const data = z
      .object({
        text: z.string().max(1000)
      })
      .parse(req.body);

    const existing = await prisma.message.findUnique({
      where: { id: req.params.messageId },
      include: { match: true }
    });
    if (!existing) {
      return res.status(404).json({ error: "Message not found" });
    }
    if (existing.fromUserId !== req.userId) {
      return res.status(403).json({ error: "You can edit only your own messages" });
    }

    const access = await ensureChatAccess(existing.matchId, req.userId!);
    if ("error" in access && access.error) {
      return res.status(access.error.status).json(access.error.body);
    }

    const trimmedText = data.text.trim();
    if (!trimmedText && !existing.attachmentUrl) {
      return res.status(400).json({ error: "Message text is required" });
    }
    if (trimmedText === existing.text) {
      return res.json(existing);
    }

    const updated = await prisma.message.update({
      where: { id: req.params.messageId },
      data: { text: trimmedText }
    });

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.get("/messages/:matchId", requireAuth, async (req, res, next) => {
  try {
    const access = await ensureChatAccess(req.params.matchId, req.userId!);
    if ("error" in access && access.error) {
      return res.status(access.error.status).json(access.error.body);
    }
    const otherUserId = access.otherUserId;

    await prisma.message.updateMany({
      where: {
        matchId: req.params.matchId,
        fromUserId: otherUserId,
        readAt: null
      },
      data: { readAt: new Date() }
    });

    const messages = await prisma.message.findMany({
      where: { matchId: req.params.matchId },
      orderBy: { createdAt: "asc" },
      take: 300
    });

    return res.json({
      messages,
      typingUserIds: getTypingUsers(req.params.matchId, req.userId!)
    });
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/messages/typing", requireAuth, async (req, res, next) => {
  try {
    const data = typingSchema.parse(req.body);
    const access = await ensureChatAccess(data.matchId, req.userId!);
    if ("error" in access && access.error) {
      return res.status(access.error.status).json(access.error.body);
    }

    const current = typingState.get(data.matchId) ?? new Map<string, number>();
    if (data.isTyping) {
      current.set(req.userId!, Date.now());
      typingState.set(data.matchId, current);
    } else {
      current.delete(req.userId!);
      if (current.size === 0) typingState.delete(data.matchId);
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

interactionsRouter.post("/blocks", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ blockedUserId: zCuid });
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

interactionsRouter.post("/reports", requireAuth, reportsThrottle, async (req, res, next) => {
  try {
    const schema = z.object({
      reportedUserId: zCuid,
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
    const autoModeration = await evaluateAutoBanForReportedUser(data.reportedUserId);
    return res.status(201).json({ ...report, autoModeration });
  } catch (err) {
    return next(err);
  }
});
