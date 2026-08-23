import { randomUUID } from "node:crypto";
import argon2 from "argon2";

import { signAccessToken } from "../auth/accessToken.ts";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "../auth/refreshToken.ts";
import { type Role } from "../domain.ts";
import { prisma } from "../lib/prisma.ts";
import {
  consumeRefreshToken,
  createRefreshToken,
  createReplacement,
  findRefreshTokenWithUser,
  revokeActiveTokensForUser,
} from "../repositories/refreshTokensRepository.ts";
import { createUser, findUserByEmail } from "../repositories/usersRepository.ts";
import { HttpError } from "../utils/httpError.ts";

const invalidCredentialsMessage = "Invalid email or password";
const invalidRefreshMessage = "Invalid refresh token";
const dummyPasswordHash = argon2.hash("eventify-dummy-password", { type: argon2.argon2id });

class RefreshRaceError extends Error {}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function storeRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await createRefreshToken({
    tokenHash: hashRefreshToken(token),
    userId,
    expiresAt: refreshTokenExpiry(),
  });
  return token;
}

async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    await argon2.verify(await dummyPasswordHash, password);
    return false;
  }
}

export async function signup(input: {
  email: string;
  password: string;
  name: string;
}): Promise<PublicUser> {
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  try {
    const user = await createUser({
      id: randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
    });
    return toPublicUser(user);
  } catch (error) {
    if (hasPrismaCode(error, "P2002")) throw new HttpError(409, "Account already exists");
    throw error;
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await findUserByEmail(input.email.toLowerCase());
  const passwordMatches = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await argon2.verify(await dummyPasswordHash, input.password);

  if (!user || !passwordMatches) throw new HttpError(401, invalidCredentialsMessage);

  return {
    accessToken: signAccessToken({ id: user.id, role: user.role }),
    refreshToken: await storeRefreshToken(user.id),
  };
}

export async function rotateRefreshToken(presentedToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const now = new Date();
  const replacementToken = generateRefreshToken();

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const current = await findRefreshTokenWithUser(
        transaction,
        hashRefreshToken(presentedToken),
      );

      if (!current || current.expiresAt <= now) return null;

      if (current.revokedAt) {
        await revokeActiveTokensForUser(transaction, current.userId, now);
        return null;
      }

      const replacement = await createReplacement(transaction, {
        tokenHash: hashRefreshToken(replacementToken),
        userId: current.userId,
        expiresAt: refreshTokenExpiry(now),
      });
      const consumed = await consumeRefreshToken(transaction, current.id, replacement.id, now);
      if (consumed.count !== 1) throw new RefreshRaceError("Refresh token was consumed concurrently");

      return current.user;
    }, { isolationLevel: "Serializable" });

    if (!user) throw new HttpError(401, invalidRefreshMessage);
    return {
      accessToken: signAccessToken({ id: user.id, role: user.role }),
      refreshToken: replacementToken,
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (hasPrismaCode(error, "P2034") || hasPrismaCode(error, "P2002") || error instanceof RefreshRaceError) {
      throw new HttpError(401, invalidRefreshMessage);
    }
    throw error;
  }
}
