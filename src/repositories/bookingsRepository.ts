import { type Booking } from "../domain.ts";
import { prisma } from "../lib/prisma.ts";

function toDomain(booking: { id: string; userId: string; eventId: string; status: "CONFIRMED" | "CANCELLED" | "WAITLISTED"; createdAt: Date }): Booking {
  return { ...booking, createdAt: booking.createdAt.toISOString() };
}

export async function findBookingById(id: string): Promise<Booking | undefined> {
  const booking = await prisma.booking.findUnique({ where: { id } });
  return booking ? toDomain(booking) : undefined;
}

export async function cancelBookingById(id: string): Promise<{
  booking: Booking | undefined;
  releasedCapacity: boolean;
}> {
  return prisma.$transaction(async (transaction) => {
    const confirmed = await transaction.booking.updateMany({
      where: { id, status: "CONFIRMED" },
      data: { status: "CANCELLED" },
    });
    if (confirmed.count === 0) {
      await transaction.booking.updateMany({
        where: { id, status: "WAITLISTED" },
        data: { status: "CANCELLED" },
      });
    }
    const booking = await transaction.booking.findUnique({ where: { id } });
    return { booking: booking ? toDomain(booking) : undefined, releasedCapacity: confirmed.count === 1 };
  });
}
