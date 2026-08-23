import { type Request, type Response } from "express";

import { type Event } from "../domain.ts";
import { getAuthenticatedUser } from "../middleware/auth.ts";
import {
  createEvent,
  deleteEvent,
  getEventById,
  listEvents,
  type ListEventsOptions,
  updateEvent,
} from "../services/eventsService.ts";
import { HttpError } from "../utils/httpError.ts";

type EventInput = Omit<Event, "id" | "createdAt" | "organizerId">;

interface EventParams {
  id: string;
}

export async function handleListEvents(_request: Request, response: Response): Promise<void> {
  const options = response.locals.query as ListEventsOptions;
  response.status(200).json(await listEvents(options));
}

export async function handleCreateEvent(request: Request, response: Response): Promise<void> {
  const input = request.body as EventInput;
  const auth = getAuthenticatedUser(response);
  response.status(201).json(await createEvent({ ...input, organizerId: auth.id }));
}

export async function handleGetEvent(_request: Request, response: Response): Promise<void> {
  const { id } = response.locals.params as EventParams;
  const event = await getEventById(id);
  if (!event) throw new HttpError(404, "Event not found");
  response.status(200).json(event);
}

export async function handleUpdateEvent(request: Request, response: Response): Promise<void> {
  const { id } = response.locals.params as EventParams;
  const event = await updateEvent(id, request.body as Partial<EventInput>, getAuthenticatedUser(response));
  if (!event) throw new HttpError(404, "Event not found");
  response.status(200).json(event);
}

export async function handleDeleteEvent(_request: Request, response: Response): Promise<void> {
  const { id } = response.locals.params as EventParams;
  const event = await deleteEvent(id, getAuthenticatedUser(response));
  if (!event) throw new HttpError(404, "Event not found");
  response.status(200).json(event);
}
