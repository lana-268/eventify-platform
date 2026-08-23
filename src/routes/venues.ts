import { Router } from "express";
import { z } from "zod";

import { validate, validateParams, validateQuery } from "../middleware/validate.ts";
import {
  handleCreateVenue,
  handleListVenues,
  handleGetVenue,
  handleUpdateVenue,
  handleDeleteVenue,
} from "../controllers/venuesController.ts";
import { requireAuth, requireRole } from "../middleware/auth.ts";

const venuesRouter = Router();
venuesRouter.use(requireAuth);

const createVenueSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  capacity: z.number().int().positive("Capacity must be a positive integer"),
  contactEmail: z.email("Valid email is required"),
}).strict();

const listVenuesSchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
}).strict();

const venueParamsSchema = z.object({
  id: z.string().uuid("Invalid venue ID"),
});

const updateVenueSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  contactEmail: z.email().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required",
});

venuesRouter.post("/", requireRole("ORGANIZER", "ADMIN"), validate(createVenueSchema), handleCreateVenue);

venuesRouter.get("/", validateQuery(listVenuesSchema), handleListVenues);

venuesRouter.get("/:id", validateParams(venueParamsSchema), handleGetVenue);

venuesRouter.patch(
  "/:id",
  requireRole("ORGANIZER", "ADMIN"),
  validateParams(venueParamsSchema),
  validate(updateVenueSchema),
  handleUpdateVenue,
);

venuesRouter.delete("/:id", requireRole("ORGANIZER", "ADMIN"), validateParams(venueParamsSchema), handleDeleteVenue);

export { venuesRouter };
