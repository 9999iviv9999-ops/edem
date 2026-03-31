import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../utils/refresh-token";
import { env } from "../lib/env";
import { requireAuth } from "../middleware/auth";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  age: z.number().int().min(18).max(80),
  gender: z.enum(["male", "female", "other"]),
  city: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const authRouter = Router();

async function createAuthSession(params: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  await prisma.refreshSession.create({
    data: {
      userId: params.userId,
      tokenHash,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt
    }
  });

  return {
    accessToken: signAccessToken(params.userId),
    refreshToken
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    const exists = await prisma.user.findUnique({ where: { email: data.email } });
    if (exists) {
      return res.status(409).json({ error: "Email already used" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        age: data.age,
        gender: data.gender,
        city: data.city,
        photos: []
      }
    });

    const tokens = await createAuthSession({
      userId: user.id,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });
    return res.status(201).json({ ...tokens, userId: user.id });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    const tokens = await createAuthSession({
      userId: user.id,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    return res.json({ ...tokens, userId: user.id });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const schema = z.object({ refreshToken: z.string().min(16) });
    const data = schema.parse(req.body);
    const tokenHash = hashRefreshToken(data.refreshToken);

    const session = await prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, isBanned: true } } }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    if (session.user.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    await prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() }
    });

    const tokens = await createAuthSession({
      userId: session.user.id,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });

    return res.json(tokens);
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const schema = z.object({ refreshToken: z.string().min(16) });
    const data = schema.parse(req.body);
    const tokenHash = hashRefreshToken(data.refreshToken);
    await prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    await prisma.refreshSession.updateMany({
      where: { userId: req.userId!, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
