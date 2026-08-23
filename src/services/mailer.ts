import { prisma } from "../lib/prisma.ts";

export async function sendBookingConfirmation(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true, event: true },
  });
  if (!booking) throw new Error(`Booking ${bookingId} no longer exists`);

  // Console transport keeps local development deterministic. Replace this function's
  // transport with SMTP credentials in deployment without changing either worker.
  console.log(JSON.stringify({
    event: "email_sent",
    kind: "booking_confirmation",
    to: booking.user.email,
    bookingId,
    eventId: booking.eventId,
    title: booking.event.title,
  }));
}
