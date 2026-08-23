import { type Prisma } from "../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";

type RefreshTokenDatabase = Pick<Prisma.TransactionClient, "refreshToken">;

interface RefreshTokenData {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

export function createRefreshToken(data: RefreshTokenData) {
  return prisma.refreshToken.create({ data });
}

export function findRefreshTokenWithUser(database: RefreshTokenDatabase, tokenHash: string) {
  return database.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
}

export function createReplacement(database: RefreshTokenDatabase, data: RefreshTokenData) {
  return database.refreshToken.create({ data });
}

export function consumeRefreshToken(
  database: RefreshTokenDatabase,
  id: string,
  replacedById: string,
  revokedAt: Date,
) {
  return database.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt, replacedById },
  });
}

export function revokeActiveTokensForUser(
  database: RefreshTokenDatabase,
  userId: string,
  revokedAt: Date,
) {
  return database.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt },
  });
}
