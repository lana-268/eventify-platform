import { type NextFunction, type Request, type Response } from "express";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  values: new Map<string, string>(),
  queueAdd: vi.fn(),
}));

vi.mock("../src/infra/redis.ts", () => ({
  getRedis: async () => ({
    get: async (key: string) => state.values.get(key) ?? null,
    set: async (key: string, value: string) => { state.values.set(key, value); return "OK"; },
    del: async (key: string) => Number(state.values.delete(key)),
    incr: async (key: string) => {
      const value = Number(state.values.get(key) ?? "0") + 1;
      state.values.set(key, String(value));
      return value;
    },
    eval: async (_script: string, options: { keys: string[] }) => {
      const key = options.keys[0]!;
      const value = Number(state.values.get(key) ?? "0") + 1;
      state.values.set(key, String(value));
      return value;
    },
  }),
}));

vi.mock("../src/jobs/waitlist.queue.ts", () => ({
  enqueueWaitlistPromotion: (eventId: string) => state.queueAdd("promote", { eventId }),
}));

import { readThrough } from "../src/infra/cache.ts";
import { promoteOldestWaitlisted } from "../src/jobs/promoteWaitlist.ts";
import { rateLimit } from "../src/middleware/rateLimit.ts";
import { prisma } from "../src/lib/prisma.ts";
import { cancelBooking, createBooking } from "../src/services/bookingsService.ts";

beforeEach(() => {
  state.values.clear();
  state.queueAdd.mockReset().mockResolvedValue(undefined);
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { userId: { startsWith: "session-5-" } } });
  await prisma.event.deleteMany({ where: { id: "50000000-0000-4000-8000-000000000001" } });
  await prisma.user.deleteMany({ where: { id: { startsWith: "session-5-" } } });
  await prisma.$disconnect();
});

describe("cache-aside reads", () => {
  it("loads a cold key once, emits a 99% hit ratio, and reuses it 99 times", async () => {
    const load = vi.fn().mockResolvedValue({ id: "event-1" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    for (let lookup = 0; lookup < 100; lookup += 1) {
      await readThrough("event:event-1", load);
    }

    expect(load).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "cache_metrics", hits: 99, misses: 1, ratio: 0.99 }));
    log.mockRestore();
  });
});

describe("fixed-window rate limiting", () => {
  async function attempt(identity: string): Promise<unknown> {
    const middleware = rateLimit({ max: 2, windowMs: 1_000, identity: () => identity });
    const request = { baseUrl: "/v1/bookings", path: "/" } as Request;
    const response = { setHeader: vi.fn() } as unknown as Response;
    let result: unknown;
    await middleware(request, response, ((error?: unknown) => { result = error; }) as NextFunction);
    return result;
  }

  it("isolates identities, rejects above the threshold, and recovers next window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_100);
    expect(await attempt("user-a")).toBeUndefined();
    expect(await attempt("user-a")).toBeUndefined();
    expect(await attempt("user-b")).toBeUndefined();
    expect(await attempt("user-a")).toMatchObject({ statusCode: 429 });

    vi.setSystemTime(11_100);
    expect(await attempt("user-a")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("waitlist promotion", () => {
  it("waitlists at capacity, promotes the oldest once, and enqueues once per cancellation", async () => {
    const eventId = "50000000-0000-4000-8000-000000000001";
    const users = ["session-5-owner", "session-5-oldest", "session-5-newest"];
    for (const id of users) {
      await prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, email: `${id}@eventify.test`, passwordHash: "not-used", name: id },
      });
    }
    await prisma.event.upsert({
      where: { id: eventId },
      update: { capacity: 1 },
      create: {
        id: eventId,
        title: "Waitlist proof",
        description: "Session 5",
        startsAt: new Date("2027-03-01T12:00:00.000Z"),
        capacity: 1,
        priceCents: 0,
        organizerId: users[0]!,
      },
    });
    await prisma.booking.deleteMany({ where: { eventId, userId: { in: users } } });

    const owner = await createBooking(users[0]!, { eventId });
    const oldest = await createBooking(users[1]!, { eventId });
    const newest = await createBooking(users[2]!, { eventId });
    expect([owner.status, oldest.status, newest.status]).toEqual(["CONFIRMED", "WAITLISTED", "WAITLISTED"]);
    await prisma.booking.update({ where: { id: oldest.id }, data: { createdAt: new Date("2026-01-01T00:00:00.000Z") } });
    await prisma.booking.update({ where: { id: newest.id }, data: { createdAt: new Date("2026-01-02T00:00:00.000Z") } });

    const auth = { id: users[0]!, role: "ATTENDEE" as const };
    await cancelBooking(owner.id, auth);
    await cancelBooking(owner.id, auth);
    expect(state.queueAdd).toHaveBeenCalledTimes(1);
    expect(state.queueAdd).toHaveBeenCalledWith("promote", { eventId });

    expect(await promoteOldestWaitlisted(eventId)).toBe(oldest.id);
    expect(await promoteOldestWaitlisted(eventId)).toBeUndefined();
    const rows = await prisma.booking.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } });
    expect(rows.filter((booking) => booking.status === "CONFIRMED").map((booking) => booking.id)).toEqual([oldest.id]);
    expect(rows.find((booking) => booking.id === newest.id)?.status).toBe("WAITLISTED");
  });
});
