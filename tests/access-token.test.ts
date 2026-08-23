import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { signAccessToken, verifyAccessToken } from "../src/auth/accessToken.ts";
import { config } from "../src/config.ts";

describe("access tokens", () => {
  it("round-trips only the expected authenticated identity", () => {
    const token = signAccessToken({ id: "user-1", role: "ORGANIZER" });
    expect(verifyAccessToken(token)).toEqual({ id: "user-1", role: "ORGANIZER" });
    const payload = jwt.decode(token) as { exp?: number; iat?: number };
    expect(payload.exp! - payload.iat!).toBe(15 * 60);
  });

  it("rejects a correctly signed token that uses an unapproved algorithm", () => {
    const token = jwt.sign(
      { role: "ADMIN" },
      config.JWT_ACCESS_SECRET,
      { algorithm: "HS384", subject: "attacker", expiresIn: "15m" },
    );
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("rejects signed tokens whose claims do not match the payload schema", () => {
    const token = jwt.sign(
      { role: "SUPERADMIN" },
      config.JWT_ACCESS_SECRET,
      { algorithm: "HS256", subject: "attacker", expiresIn: "15m" },
    );
    expect(() => verifyAccessToken(token)).toThrow();
  });
});
