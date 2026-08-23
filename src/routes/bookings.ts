import { Router } from "express";
import { z } from "zod";

import {
  handleCancelBooking,
  handleCreateBooking,
  handleGetBooking,
} from "../controllers/bookingsController.ts";
import { getAuthenticatedUser, requireAuth } from "../middleware/auth.ts";
import { rateLimit } from "../middleware/rateLimit.ts";
import { validate, validateParams } from "../middleware/validate.ts";

const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

const createBookingSchema = z.strictObject({
  eventId: z.string().min(1, "Event ID is required"),
});

const bookingParamsSchema = z.strictObject({
  id: z.string().uuid("Invalid booking ID"),
});

export const bookingRateLimit = { max: 10, windowMs: 10_000 } as const;

bookingsRouter.post(
  "/",
  rateLimit({ ...bookingRateLimit, identity: (_request, response) => getAuthenticatedUser(response).id }),
  validate(createBookingSchema),
  handleCreateBooking,
);
bookingsRouter.get("/:id", validateParams(bookingParamsSchema), handleGetBooking);
bookingsRouter.delete("/:id", validateParams(bookingParamsSchema), handleCancelBooking);

export { bookingsRouter };
