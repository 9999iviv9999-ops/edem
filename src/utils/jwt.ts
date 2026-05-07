import jwt from "jsonwebtoken";
import { env } from "../lib/env";

type AccessPayload = {
  userId: string;
  tokenType: "access";
};

export function signAccessToken(userId: string): string {
  const payload = { userId, tokenType: "access" as const };
  if (env.ACCESS_TOKEN_TTL_MINUTES <= 0) {
    return jwt.sign(payload, env.JWT_SECRET);
  }
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET) as AccessPayload;
  if (decoded.tokenType !== "access") {
    throw new Error("Invalid token type");
  }
  return decoded;
}
