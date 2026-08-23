import { Router } from "express";
import { z } from "zod";

import { handleCreateEvent, handleDeleteEvent, handleGetEvent, handleListEvents, handleUpdateEvent } from "../controllers/eventsController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";
import { validate, validateParams, validateQuery } from "../middleware/validate.ts";

const eventsRouter = Router();

const listEventsSchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  venue: z.string().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

const eventSchema = z.strictObject({
  title: z.string().min(1),
  description: z.string(),
  venue: z.string().nullable().optional(),
  startsAt: z.iso.datetime(),
  capacity: z.number().int().positive(),
  priceCents: z.number().int().nonnegative(),
});

const eventParamsSchema = z.strictObject({
  id: z.string().uuid("Invalid event ID"),
});

eventsRouter.get("/", validateQuery(listEventsSchema), handleListEvents);
eventsRouter.get("/:id", validateParams(eventParamsSchema), handleGetEvent);
eventsRouter.post("/", requireAuth, requireRole("ORGANIZER", "ADMIN"), validate(eventSchema), handleCreateEvent);
eventsRouter.patch("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), validateParams(eventParamsSchema), validate(eventSchema.partial()), handleUpdateEvent);
eventsRouter.delete("/:id", requireAuth, requireRole("ORGANIZER", "ADMIN"), validateParams(eventParamsSchema), handleDeleteEvent);

export { eventsRouter };
