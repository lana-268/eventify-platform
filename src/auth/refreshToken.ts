import { createHash, randomBytes } from "node:crypto";
import { type Response } from "express";

export const refreshTokenCookieName = "refreshToken";
export const refreshTokenLifetimeMs = 7 * 24 * 60 * 60 * 1_000;

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + refreshTokenLifetimeMs);
}

export function setRefreshTokenCookie(response: Response, token: string): void {
  response.cookie(refreshTokenCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/v1/auth/refresh",
    maxAge: refreshTokenLifetimeMs,
  });
}
