import { type Request, type Response } from "express";

import { refreshTokenCookieName, setRefreshTokenCookie } from "../auth/refreshToken.ts";
import { login, rotateRefreshToken, signup } from "../services/authService.ts";
import { HttpError } from "../utils/httpError.ts";

export async function handleSignup(request: Request, response: Response): Promise<void> {
  response.status(201).json({ user: await signup(request.body) });
}

export async function handleLogin(request: Request, response: Response): Promise<void> {
  const pair = await login(request.body);
  setRefreshTokenCookie(response, pair.refreshToken);
  response.status(200).json({ accessToken: pair.accessToken });
}

export async function handleRefresh(request: Request, response: Response): Promise<void> {
  const token = request.cookies?.[refreshTokenCookieName] as unknown;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new HttpError(401, "Invalid refresh token");
  }

  const pair = await rotateRefreshToken(token);
  setRefreshTokenCookie(response, pair.refreshToken);
  response.status(200).json({ accessToken: pair.accessToken });
}
