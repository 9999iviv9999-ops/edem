import dotenv from "dotenv";
import crypto from "node:crypto";
import { z } from "zod";

dotenv.config();

const optKey = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().min(1).optional()
);

const defaultWebhookSecret = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "dev-secret")
  .digest("hex");

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  ADMIN_MODERATION_KEY: z.string().min(8),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("ru-central1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL_BASE: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  /** https://platform.2gis.ru — Places / Catalog API */
  DGIS_API_KEY: optKey,
  /** https://developer.tech.yandex.ru — Поиск по организациям (Geosearch) */
  YANDEX_MAPS_API_KEY: optKey,
  VPROK_WEBHOOK_SECRET: z.string().default(defaultWebhookSecret),
  VPROK_PAYMENT_PROVIDER: z.string().default("mock"),
  /** Комиссия платформы: 300 = 3.00% от суммы заказа (копейки покупателя). */
  VPROK_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(300)
});

export const env = envSchema.parse(process.env);
