import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../utils/jwt";
import { generateRefreshToken, hashRefreshToken } from "../utils/refresh-token";
import { env } from "../lib/env";
import { normalizePhone } from "../lib/phone-normalize";
import { syncProfileBadgeForPhone } from "../lib/profile-badge-sync";
import { requireAuth } from "../middleware/auth";
import { createRequestThrottle } from "../middleware/request-throttle";

const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone format"),
  password: z.string().min(6),
  name: z.string().min(1),
  age: z.number().int().min(18).max(80),
  gender: z.enum(["male", "female", "other"]),
  city: z.string().min(1),
  okrug: z.string().max(200).optional(),
  district: z.string().max(200).optional()
});

const loginSchema = z
  .object({
    email: z.string().trim().email().optional(),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone format").optional(),
    password: z.string().min(6)
  })
  .refine((v) => Boolean(v.email || v.phone), {
    message: "Email or phone is required"
  });

export const authRouter = Router();
const authByIpThrottle = createRequestThrottle({
  keyPrefix: "auth-by-ip",
  windowMs: 10 * 60 * 1000,
  max: 30,
  errorMessage: "Too many auth attempts. Try again in a few minutes.",
  keyGenerator: (req) => req.ip || "unknown"
});
const loginByIdentityThrottle = createRequestThrottle({
  keyPrefix: "login-by-identity",
  windowMs: 10 * 60 * 1000,
  max: 10,
  errorMessage: "Too many login attempts for this account. Try again later.",
  keyGenerator: (req) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    return email || phone || (req.ip || "unknown");
  }
});
const googleAuthClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

function buildAuthRedirect(mode: "login" | "register", tokens: { accessToken: string; refreshToken: string }) {
  const base = env.WEB_BASE_URL.replace(/\/+$/, "");
  const targetPath = mode === "register" ? "/register" : "/login";
  const params = new URLSearchParams({
    social: "vk",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  });
  return `${base}${targetPath}?${params.toString()}`;
}

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

authRouter.post("/register", authByIpThrottle, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const email = data.email.trim().toLowerCase();
    const phone = normalizePhone(data.phone);

    const exists = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phone }]
      }
    });
    if (exists) {
      return res.status(409).json({ error: "Email or phone already used" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        phone,
        passwordHash,
        name: data.name,
        age: data.age,
        gender: data.gender,
        city: data.city,
        okrug: data.okrug,
        district: data.district,
        photos: []
      }
    });

    await syncProfileBadgeForPhone(phone, user.id);

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

authRouter.post("/login", authByIpThrottle, loginByIdentityThrottle, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email?.trim().toLowerCase();
    const phone = data.phone ? normalizePhone(data.phone) : undefined;
    const phoneNoPlus = phone ? phone.replace(/^\+/, "") : undefined;

    const orClause: Array<{ email?: { equals: string; mode: "insensitive" }; phone?: string }> = [];
    if (email) {
      orClause.push({ email: { equals: email, mode: "insensitive" } });
    }
    if (phone) {
      orClause.push({ phone });
      if (phoneNoPlus) {
        orClause.push({ phone: phoneNoPlus });
      }
    }

    const user = await prisma.user.findFirst({
      where: { OR: orClause }
    });
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

    await syncProfileBadgeForPhone(user.phone, user.id);

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

authRouter.post("/social/google", authByIpThrottle, async (req, res, next) => {
  try {
    const schema = z.object({ idToken: z.string().min(20) });
    const data = schema.parse(req.body);
    if (!googleAuthClient || !env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: "Google login is not configured" });
    }

    const ticket = await googleAuthClient.verifyIdToken({
      idToken: data.idToken,
      audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: "Google account email is required" });
    }

    const email = payload.email.trim().toLowerCase();
    const googleSub = payload.sub;
    const fullName = (payload.name || payload.given_name || "Пользователь").trim();
    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, isBanned: true }
    });
    if (existingByEmail?.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    let userId = existingByEmail?.id;
    if (!userId) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const created = await prisma.user.create({
        data: {
          email,
          phone: `social-google-${googleSub}`,
          passwordHash,
          name: fullName,
          age: 22,
          gender: "other",
          city: "Москва",
          photos: []
        }
      });
      userId = created.id;
    }

    const tokens = await createAuthSession({
      userId,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });
    return res.json({ ...tokens, userId });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/social/vk/start", authByIpThrottle, async (req, res, next) => {
  try {
    if (!env.VK_CLIENT_ID || !env.VK_REDIRECT_URI) {
      return res.status(503).json({ error: "VK login is not configured" });
    }
    const mode = req.query.mode === "register" ? "register" : "login";
    const params = new URLSearchParams({
      client_id: env.VK_CLIENT_ID,
      redirect_uri: env.VK_REDIRECT_URI,
      response_type: "code",
      scope: "email",
      state: mode,
      v: "5.199"
    });
    return res.redirect(`https://oauth.vk.com/authorize?${params.toString()}`);
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/social/vk/callback", authByIpThrottle, async (req, res, next) => {
  try {
    if (!env.VK_CLIENT_ID || !env.VK_CLIENT_SECRET || !env.VK_REDIRECT_URI) {
      return res.status(503).json({ error: "VK login is not configured" });
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const mode = req.query.state === "register" ? "register" : "login";
    if (!code) {
      return res.status(400).json({ error: "Missing VK auth code" });
    }

    const tokenParams = new URLSearchParams({
      client_id: env.VK_CLIENT_ID,
      client_secret: env.VK_CLIENT_SECRET,
      redirect_uri: env.VK_REDIRECT_URI,
      code
    });
    const tokenResponse = await fetch(`https://oauth.vk.com/access_token?${tokenParams.toString()}`);
    if (!tokenResponse.ok) {
      return res.status(502).json({ error: "VK token exchange failed" });
    }
    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      user_id?: number;
      email?: string;
      error?: string;
      error_description?: string;
    };
    if (tokenData.error || !tokenData.access_token || !tokenData.user_id) {
      return res.status(401).json({ error: tokenData.error_description || "VK login failed" });
    }

    const userInfoParams = new URLSearchParams({
      user_ids: String(tokenData.user_id),
      fields: "first_name,last_name",
      access_token: tokenData.access_token,
      v: "5.199"
    });
    const userInfoResponse = await fetch(
      `https://api.vk.com/method/users.get?${userInfoParams.toString()}`
    );
    if (!userInfoResponse.ok) {
      return res.status(502).json({ error: "VK profile fetch failed" });
    }
    const userInfoData = (await userInfoResponse.json()) as {
      response?: Array<{ first_name?: string; last_name?: string }>;
    };
    const vkProfile = userInfoData.response?.[0];
    const fullName = `${vkProfile?.first_name || ""} ${vkProfile?.last_name || ""}`.trim() || "Пользователь";
    const email = tokenData.email?.trim().toLowerCase() || `vk_${tokenData.user_id}@vk.local`;

    const existingByEmail = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, isBanned: true }
    });
    if (existingByEmail?.isBanned) {
      return res.status(403).json({ error: "Account is banned" });
    }

    let userId = existingByEmail?.id;
    if (!userId) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const created = await prisma.user.create({
        data: {
          email,
          phone: `social-vk-${tokenData.user_id}`,
          passwordHash,
          name: fullName,
          age: 22,
          gender: "other",
          city: "Москва",
          photos: []
        }
      });
      userId = created.id;
    }

    const tokens = await createAuthSession({
      userId,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip
    });
    return res.redirect(buildAuthRedirect(mode, tokens));
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

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(6),
      newPassword: z.string().min(6)
    });
    const data = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, passwordHash: true }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    if (data.currentPassword === data.newPassword) {
      return res.status(400).json({ error: "New password must be different" });
    }

    const newHash = await bcrypt.hash(data.newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
