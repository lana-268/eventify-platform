import { signAccessToken } from "../../src/auth/accessToken.ts";
import { type Role } from "../../src/domain.ts";

export function bearerToken(id: string, role: Role): string {
  return `Bearer ${signAccessToken({ id, role })}`;
}
