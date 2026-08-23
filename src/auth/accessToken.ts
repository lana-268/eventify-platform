import jwt from "jsonwebtoken";
import { z } from "zod";

import { config } from "../config.ts";
import { type Role } from "../domain.ts";

const accessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(["ATTENDEE", "ORGANIZER", "ADMIN"]),
});

export interface AuthenticatedUser {
  id: string;
  role: Role;
}

export function signAccessToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { role: user.role },
    config.JWT_ACCESS_SECRET,
    { algorithm: "HS256", expiresIn: "15m", subject: user.id },
  );
}

export function verifyAccessToken(token: string): AuthenticatedUser {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  const parsed = accessTokenPayloadSchema.parse(payload);
  return { id: parsed.sub, role: parsed.role };
}
