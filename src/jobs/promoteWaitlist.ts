import { prisma } from "../lib/prisma.ts";

const maximumTransactionAttempts = 10;

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function promoteOldestWaitlisted(eventId: string): Promise<string | undefined> {
  for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const event = await transaction.event.findUnique({ where: { id: eventId } });
        if (!event) return undefined;

        const confirmed = await transaction.booking.count({
          where: { eventId, status: "CONFIRMED" },
        });
        if (confirmed >= event.capacity) return undefined;

        const oldest = await transaction.booking.findFirst({
          where: { eventId, status: "WAITLISTED" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (!oldest) return undefined;

        const promoted = await transaction.booking.updateMany({
          where: { id: oldest.id, status: "WAITLISTED" },
          data: { status: "CONFIRMED" },
        });
        return promoted.count === 1 ? oldest.id : undefined;
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (hasPrismaCode(error, "P2034") && attempt < maximumTransactionAttempts) continue;
      throw error;
    }
  }
  return undefined;
}
