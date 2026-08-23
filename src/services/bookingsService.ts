import { type Booking } from "../domain.ts";
import { type AuthenticatedUser } from "../auth/accessToken.ts";
import { prisma } from "../lib/prisma.ts";
import { cancelBookingById, findBookingById } from "../repositories/bookingsRepository.ts";
import { HttpError } from "../utils/httpError.ts";
import { enqueueWaitlistPromotion } from "../jobs/waitlist.queue.ts";

export interface CreateBookingInput {
  eventId: string;
}

const maximumTransactionAttempts = 10;

function toDomain(booking: {
  id: string;
  userId: string;
  eventId: string;
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED";
  createdAt: Date;
}): Booking {
  return { ...booking, createdAt: booking.createdAt.toISOString() };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isSerializationConflict(error: unknown): boolean {
  if (hasPrismaCode(error, "P2034")) return true;
  if (typeof error !== "object" || error === null || !("cause" in error)) return false;

  const cause = error.cause;
  return typeof cause === "object" && cause !== null && (
    ("originalCode" in cause && cause.originalCode === "40001") ||
    ("kind" in cause && cause.kind === "TransactionWriteConflict")
  );
}

export async function createBooking(userId: string, input: CreateBookingInput): Promise<Booking> {
  for (let attempt = 1; attempt <= maximumTransactionAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { id: input.eventId } });
        if (!event) throw new HttpError(404, "Event not found");

        const confirmedBookings = await tx.booking.count({
          where: { eventId: input.eventId, status: "CONFIRMED" },
        });
        const status = confirmedBookings >= event.capacity ? "WAITLISTED" : "CONFIRMED";

        const bookingKey = { userId, eventId: input.eventId };
        const existing = await tx.booking.findUnique({
          where: { userId_eventId: bookingKey },
        });

        if (existing?.status === "CANCELLED") {
          const rebooked = await tx.booking.update({
            where: { userId_eventId: bookingKey },
            data: { status },
          });
          return toDomain(rebooked);
        }

        if (existing?.status === "WAITLISTED") {
          throw new HttpError(409, "Booking already exists for this event");
        }

        // If a confirmed row already exists, create deliberately reaches the
        // unique constraint so the P2002 handler remains the final race-safe guard.
        const booking = await tx.booking.create({
          data: { ...bookingKey, status },
        });
        return toDomain(booking);
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (isSerializationConflict(error)) {
        if (attempt < maximumTransactionAttempts) continue;
        throw new HttpError(409, "Booking could not be completed because of concurrent requests");
      }
      if (hasPrismaCode(error, "P2002")) {
        throw new HttpError(409, "Booking already exists for this event");
      }
      throw error;
    }
  }

  throw new HttpError(409, "Booking could not be completed");
}

export async function getBookingById(id: string, auth: AuthenticatedUser): Promise<Booking> {
  const booking = await findBookingById(id);
  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }
  if (auth.role !== "ADMIN" && booking.userId !== auth.id) {
    throw new HttpError(403, "Forbidden");
  }
  return booking;
}

export async function cancelBooking(id: string, auth: AuthenticatedUser): Promise<Booking> {
  const booking = await findBookingById(id);
  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.userId !== auth.id) throw new HttpError(403, "Forbidden");
  const { booking: cancelled, releasedCapacity } = await cancelBookingById(id);
  if (!cancelled) throw new HttpError(404, "Booking not found");
  if (releasedCapacity) {
    try {
      await enqueueWaitlistPromotion(booking.eventId);
    } catch (error) {
      console.error(JSON.stringify({ event: "waitlist_enqueue_failed", eventId: booking.eventId, message: String(error) }));
    }
  }
  return cancelled;
}
