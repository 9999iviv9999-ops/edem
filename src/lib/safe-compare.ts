import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time–friendly comparison of two UTF-8 strings (length not leaked via early exit). */
export function secretsEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

/** Compare two hex-encoded digests of the same byte length (e.g. sha256 HMAC). */
export function hexDigestsEqual(a: string, b: string): boolean {
  const aa = String(a || "").trim().toLowerCase();
  const bb = String(b || "").trim().toLowerCase();
  if (!aa || !bb || aa.length !== bb.length) return false;
  try {
    const ba = Buffer.from(aa, "hex");
    const bbuf = Buffer.from(bb, "hex");
    if (ba.length !== bbuf.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bbuf);
  } catch {
    return false;
  }
}
