import { NextFunction, Request, Response } from "express";
import { env } from "../lib/env";

export function requireModerationKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-moderation-key");
  if (!key || key !== env.ADMIN_MODERATION_KEY) {
    return res.status(401).json({ error: "Unauthorized moderation key" });
  }
  return next();
}
