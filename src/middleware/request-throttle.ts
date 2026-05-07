import { NextFunction, Request, Response } from "express";

type KeyGenerator = (req: Request) => string;

type RequestThrottleOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  errorMessage: string;
  keyGenerator?: KeyGenerator;
};

const buckets = new Map<string, number[]>();

function defaultKeyGenerator(req: Request): string {
  return req.userId || req.ip || "anonymous";
}

export function createRequestThrottle(options: RequestThrottleOptions) {
  const keyFn = options.keyGenerator || defaultKeyGenerator;
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${options.keyPrefix}:${keyFn(req)}`;
    const now = Date.now();
    const minTs = now - options.windowMs;

    const existing = buckets.get(key) || [];
    const recent = existing.filter((ts) => ts > minTs);
    if (recent.length >= options.max) {
      return res.status(429).json({ error: options.errorMessage });
    }

    recent.push(now);
    buckets.set(key, recent);
    return next();
  };
}

