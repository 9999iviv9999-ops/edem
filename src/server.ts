import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { env } from "./lib/env";
import { prisma } from "./lib/prisma";
import { authRouter } from "./routes/auth";
import { gymsRouter } from "./routes/gyms";
import { profilesRouter } from "./routes/profiles";
import { interactionsRouter } from "./routes/interactions";
import { mediaRouter } from "./routes/media";
import { moderationRouter } from "./routes/moderation";
import { errorHandler } from "./middleware/error-handler";
import { createRequestThrottle } from "./middleware/request-throttle";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const explicitOrigins = env.CORS_ALLOW_ORIGINS.split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const defaultOrigins = [env.WEB_BASE_URL, "https://edem.press", "https://www.edem.press", "https://app.edem.press"];
const allowedOrigins = new Set([...defaultOrigins, ...explicitOrigins]);

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin)) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return cb(null, true);
      try {
        const host = new URL(origin).hostname;
        if (host === "edem-web.vercel.app" || host.endsWith(".vercel.app")) return cb(null, true);
      } catch {
        /* ignore */
      }
      return cb(new Error("CORS origin blocked"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(
  createRequestThrottle({
    keyPrefix: "global-by-ip",
    windowMs: 60 * 1000,
    max: 240,
    errorMessage: "Too many requests. Please try again shortly.",
    keyGenerator: (req) => req.ip || "unknown"
  })
);

async function healthHandler(req: express.Request, res: express.Response) {
  const deep =
    req.query.deep === "1" ||
    req.query.deep === "true" ||
    String(req.query.deep || "").toLowerCase() === "yes";
  if (!deep) {
    res.json({ status: "ok", service: "edem-api" });
    return;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "edem-api", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", service: "edem-api", db: "unreachable" });
  }
}

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

app.use("/api/auth", authRouter);
app.use("/api/gyms", gymsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api", interactionsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/moderation", moderationRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`ЭДЕМ API is running on port ${env.PORT}`);
});
