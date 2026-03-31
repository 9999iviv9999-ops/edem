import jwt from "jsonwebtoken";
import { env } from "../lib/env";

type AccessPayload = {
  userId: string;
  tokenType: "access";
};

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId, tokenType: "access" }, env.JWT_SECRET, {
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
