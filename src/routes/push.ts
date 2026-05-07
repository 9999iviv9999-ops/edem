import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

export const pushRouter = Router();

const registerSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["ios", "android", "unknown"])
});

pushRouter.post("/devices", requireAuth, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const userId = req.userId!;

    await prisma.$transaction([
      prisma.pushDevice.deleteMany({ where: { token: data.token } }),
      prisma.pushDevice.create({
        data: {
          userId,
          token: data.token,
          platform: data.platform
        }
      })
    ]);

    console.log(
      `[push] device registered userId=${userId} platform=${data.platform} tokenLen=${data.token.length}`
    );
    return res.json({ ok: true });
  } catch (err) {
    console.warn("[push] register failed", err);
    return next(err);
  }
});

pushRouter.delete("/devices", requireAuth, async (req, res, next) => {
  try {
    const data = z.object({ token: z.string().min(1) }).parse(req.body);
    await prisma.pushDevice.deleteMany({
      where: { userId: req.userId!, token: data.token }
    });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
