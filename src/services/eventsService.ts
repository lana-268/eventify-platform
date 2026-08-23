import { type Event } from "../domain.ts";
import { type AuthenticatedUser } from "../auth/accessToken.ts";
import * as eventsRepository from "../repositories/eventsRepository.ts";
import {
  currentEventListVersion,
  deleteCacheKey,
  invalidateEventLists,
  readThrough,
} from "../infra/cache.ts";
import { HttpError } from "../utils/httpError.ts";

export interface ListEventsOptions {
  page: number;
  limit: number;
  venue?: string;
  from?: string;
  to?: string;
}

export interface PaginatedEvents {
  data: Event[];
  page: number;
  limit: number;
  total: number;
}

export async function getEventById(id: string): Promise<Event | undefined> {
  return readThrough(`event:${id}`, () => eventsRepository.findEventById(id));
}

export async function listEvents(options: ListEventsOptions): Promise<PaginatedEvents> {
  const version = await currentEventListVersion();
  const isDefaultShape = options.limit === 20 && !options.venue && !options.from && !options.to;
  const suffix = isDefaultShape
    ? ""
    : `:${encodeURIComponent(JSON.stringify({ limit: options.limit, venue: options.venue, from: options.from, to: options.to }))}`;
  return readThrough(`events:list:${version}:${options.page}${suffix}`, async () => {
    const result = await eventsRepository.findEvents(options);
    return { data: result.data, page: options.page, limit: options.limit, total: result.total };
  });
}

export async function createEvent(data: eventsRepository.EventData): Promise<Event> {
  const event = await eventsRepository.createEvent(data);
  await invalidateEventLists();
  return event;
}

async function requireEventOwner(id: string, auth: AuthenticatedUser): Promise<Event | undefined> {
  const event = await eventsRepository.findEventById(id);
  if (!event) return undefined;
  if (auth.role !== "ADMIN" && event.organizerId !== auth.id) {
    throw new HttpError(403, "Forbidden");
  }
  return event;
}

export async function updateEvent(
  id: string,
  data: Partial<eventsRepository.EventData>,
  auth: AuthenticatedUser,
): Promise<Event | undefined> {
  if (!await requireEventOwner(id, auth)) return undefined;
  const event = await eventsRepository.updateEvent(id, data);
  if (event) await Promise.all([deleteCacheKey(`event:${id}`), invalidateEventLists()]);
  return event;
}

export async function deleteEvent(id: string, auth: AuthenticatedUser): Promise<Event | undefined> {
  if (!await requireEventOwner(id, auth)) return undefined;
  const event = await eventsRepository.deleteEvent(id);
  if (event) await Promise.all([deleteCacheKey(`event:${id}`), invalidateEventLists()]);
  return event;
}
