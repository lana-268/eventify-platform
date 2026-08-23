import { type NextFunction, type Request, type Response } from "express";

import { config } from "../config.ts";
import { type Role } from "../domain.ts";
import { type AuthenticatedUser, verifyAccessToken } from "../auth/accessToken.ts";
import { HttpError } from "../utils/httpError.ts";

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.header("authorization");
  const [scheme, token, extra] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token || extra) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  try {
    response.locals.auth = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, "Authentication required"));
  }
}

export function requireRole(...roles: Role[]) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    const auth = response.locals.auth as AuthenticatedUser | undefined;
    if (!auth) {
      next(new HttpError(401, "Authentication required"));
      return;
    }
    if (!roles.includes(auth.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }
    next();
  };
}

export function requireTrustedOrigin(request: Request, _response: Response, next: NextFunction): void {
  const origin = request.header("origin");
  if (origin && origin !== new URL(config.WEB_ORIGIN).origin) {
    next(new HttpError(403, "Forbidden"));
    return;
  }
  next();
}

export function getAuthenticatedUser(response: Response): AuthenticatedUser {
  const auth = response.locals.auth as AuthenticatedUser | undefined;
  if (!auth) throw new HttpError(500, "Authentication context missing");
  return auth;
}
