import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./lib/env";
import { assertPrismaUserTableQueryable } from "./lib/schema-guard";
import { authRouter } from "./routes/auth";
import { mediaRouter } from "./routes/media";
import { vprokRouter } from "./routes/vprok";
import { errorHandler } from "./middleware/error-handler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "vprok-api",
    mode: "vprok-only"
  });
});

app.use("/api/auth", authRouter);
app.use("/api/media", mediaRouter);
app.use("/api/vprok", vprokRouter);

app.use(errorHandler);

async function bootstrap() {
  await assertPrismaUserTableQueryable();
  app.listen(env.PORT, () => {
    console.log(`Vprok API is running on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

