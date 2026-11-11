import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export interface SessionPayload {
  userId: string;
  email: string;
  creatorId?: string;
  slug?: string;
  iat: number;
  exp: number;
}

const COOKIE_NAME = "hp_session";

export function signSession(payload: Omit<SessionPayload, "iat" | "exp">, secret: string): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 30 * 24 * 3600; // 30 days
  const data: SessionPayload = { ...payload, iat, exp };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const hmac = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${hmac}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
    if (signature !== expected) return null;

    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 30 * 24 * 3600,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getSession(req: FastifyRequest, secret: string): SessionPayload | null {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token, secret);
}
