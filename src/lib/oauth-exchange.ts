import crypto from "node:crypto";

type Entry = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  /** After first successful exchange, same code may be replayed briefly (React Strict Mode, double fetch). */
  consumedAt?: number;
};

const store = new Map<string, Entry>();
const TTL_MS = 10 * 60 * 1000;
const REPLAY_AFTER_CONSUME_MS = 2 * 60 * 1000;

function sweep(now: number) {
  for (const [k, v] of store.entries()) {
    if (v.expiresAt <= now) {
      store.delete(k);
      continue;
    }
    if (v.consumedAt && now - v.consumedAt > REPLAY_AFTER_CONSUME_MS) {
      store.delete(k);
    }
  }
}

/**
 * One-time codes for OAuth redirects (e.g. VK). Tokens must not appear in query strings
 * (logs, Referer, browser history). In-memory store: use one API instance or replace with Redis.
 */
export function createOAuthExchangeCode(tokens: { accessToken: string; refreshToken: string }): string {
  const now = Date.now();
  sweep(now);
  const code = crypto.randomBytes(32).toString("base64url");
  store.set(code, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: now + TTL_MS
  });
  return code;
}

export function consumeOAuthExchangeCode(code: string): { accessToken: string; refreshToken: string } | null {
  const now = Date.now();
  sweep(now);
  const trimmed = code.trim();
  if (!trimmed) return null;
  const entry = store.get(trimmed);
  if (!entry || entry.expiresAt <= now) {
    store.delete(trimmed);
    return null;
  }
  if (entry.consumedAt) {
    if (now - entry.consumedAt <= REPLAY_AFTER_CONSUME_MS) {
      return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
    }
    store.delete(trimmed);
    return null;
  }
  entry.consumedAt = now;
  return { accessToken: entry.accessToken, refreshToken: entry.refreshToken };
}
