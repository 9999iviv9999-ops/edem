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
  /**
   * 0 = access JWT без поля exp (пользователь остаётся «вошедшим», пока не выйдет / бан / смена JWT_SECRET).
   * >0 = срок в минутах (для жёсткого режима).
   */
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(0).default(0),
  /** Срок записи refresh в БД (выход из всех устройств отзывает раньше). */
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(36500),
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
  VPROK_PLATFORM_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(300),
  GOOGLE_CLIENT_ID: optKey,
  VK_CLIENT_ID: optKey,
  VK_CLIENT_SECRET: optKey,
  VK_REDIRECT_URI: optKey,
  WEB_BASE_URL: z.string().url().default("https://edem.press"),
  /**
   * Разрешить любой origin *.vercel.app с credentials (удобно для preview, но шире поверхность атаки).
   * В проде лучше 0 и перечислить нужные origin в CORS_ALLOW_ORIGINS.
   */
  CORS_ALLOW_VERCEL_APP: z
    .preprocess((v) => {
      if (v === true || v === "1" || v === "true") return true;
      if (v === false || v === "0" || v === "false" || v === "" || v === undefined || v === null)
        return false;
      return Boolean(v);
    }, z.boolean())
    .default(false),
  CORS_ALLOW_ORIGINS: z.string().optional().default(""),
  /** Сколько минут статус "Я в зале" считается активным. */
  IN_GYM_ACTIVE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(120),
  /** Номер (как в БД, с + или без) — при логине/регистрации выставляется profileBadge */
  VIP_PROFILE_BADGE_PHONE: optKey,
  VIP_PROFILE_BADGE_LABEL: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.string().max(120).default("Founder Diamond")
  )
});

export const env = envSchema.parse(process.env);
