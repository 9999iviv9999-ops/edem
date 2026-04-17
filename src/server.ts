import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./lib/env";
import { authRouter } from "./routes/auth";
import { gymsRouter } from "./routes/gyms";
import { profilesRouter } from "./routes/profiles";
import { interactionsRouter } from "./routes/interactions";
import { mediaRouter } from "./routes/media";
import { moderationRouter } from "./routes/moderation";
import { vprokRouter } from "./routes/vprok";
import { errorHandler } from "./middleware/error-handler";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "edem-api" });
});

app.use("/api/auth", authRouter);
app.use("/api/gyms", gymsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api", interactionsRouter);
app.use("/api/media", mediaRouter);
app.use("/api/moderation", moderationRouter);
app.use("/api/vprok", vprokRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Edem API is running on port ${env.PORT}`);
});
