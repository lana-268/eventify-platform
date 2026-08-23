import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { redis, getRedis } from "../src/infra/redis.ts";
import { waitlistQueue } from "../src/jobs/waitlist.queue.ts";
import { prisma } from "../src/lib/prisma.ts";
import { bearerToken } from "./helpers/auth.ts";

const app = createApp();
const password = "Capstone123!";

function refreshCookie(response: request.Response): string {
  const values = response.headers["set-cookie"] as unknown;
  if (!Array.isArray(values) || typeof values[0] !== "string") {
    throw new Error("Expected a refresh-token cookie");
  }
  return values[0].split(";", 1)[0]!;
}

async function createUser(role: "ATTENDEE" | "ORGANIZER" | "ADMIN") {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: `${id}@eventify.test`,
      passwordHash: "not-used-by-token-tests",
      name: `${role} fixture`,
      role,
    },
  });
  return { id, authorization: bearerToken(id, role) };
}

async function createEvent(organizerId: string, capacity = 1) {
  return prisma.event.create({
    data: {
      title: "Capstone event",
      description: "Integration fixture",
      startsAt: new Date("2027-06-01T12:00:00.000Z"),
      capacity,
      priceCents: 0,
      organizerId,
    },
  });
}

beforeEach(async () => {
  await (await getRedis()).flushDb();
  await prisma.refreshToken.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await waitlistQueue.close();
  if (redis.isOpen) await redis.quit();
  await prisma.$disconnect();
});

describe("Eventify v1.0 acceptance", () => {
  it("registers, logs in, and rotates a refresh token exactly once", async () => {
    const email = "capstone-auth@eventify.test";
    const registered = await request(app)
      .post("/v1/auth/signup")
      .send({ email, password, name: "Capstone Attendee" })
      .expect(201);
    expect(registered.body.user).toMatchObject({ email, role: "ATTENDEE" });

    const login = await request(app)
      .post("/v1/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
    const firstCookie = refreshCookie(login);

    const rotated = await request(app)
      .post("/v1/auth/refresh")
      .set("origin", new URL(config.WEB_ORIGIN).origin)
      .set("cookie", firstCookie)
      .expect(200);
    expect(rotated.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(rotated)).not.toBe(firstCookie);

    await request(app)
      .post("/v1/auth/refresh")
      .set("origin", new URL(config.WEB_ORIGIN).origin)
      .set("cookie", firstCookie)
      .expect(401);
  });

  it("allows ORGANIZER event creation and rejects ATTENDEE with 403", async () => {
    const organizer = await createUser("ORGANIZER");
    const attendee = await createUser("ATTENDEE");
    const event = {
      title: "Role-gated event",
      description: "Created through the API",
      startsAt: "2027-07-01T12:00:00.000Z",
      capacity: 10,
      priceCents: 0,
    };

    const created = await request(app)
      .post("/v1/events")
      .set("authorization", organizer.authorization)
      .send(event)
      .expect(201);
    expect(created.body.organizerId).toBe(organizer.id);

    await request(app)
      .post("/v1/events")
      .set("authorization", attendee.authorization)
      .send(event)
      .expect(403);
  });

  it("returns WAITLISTED when an event is full", async () => {
    const organizer = await createUser("ORGANIZER");
    const first = await createUser("ATTENDEE");
    const second = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id);

    const confirmed = await request(app)
      .post("/v1/bookings")
      .set("authorization", first.authorization)
      .send({ eventId: event.id })
      .expect(201);
    const waitlisted = await request(app)
      .post("/v1/bookings")
      .set("authorization", second.authorization)
      .send({ eventId: event.id })
      .expect(201);

    expect(confirmed.body.status).toBe("CONFIRMED");
    expect(waitlisted.body.status).toBe("WAITLISTED");
  });

  it("reactivates the same row as CONFIRMED after cancel then rebook", async () => {
    const organizer = await createUser("ORGANIZER");
    const attendee = await createUser("ATTENDEE");
    const event = await createEvent(organizer.id);

    const booked = await request(app)
      .post("/v1/bookings")
      .set("authorization", attendee.authorization)
      .send({ eventId: event.id })
      .expect(201);
    await request(app)
      .delete(`/v1/bookings/${booked.body.id as string}`)
      .set("authorization", attendee.authorization)
      .expect(200);
    const rebooked = await request(app)
      .post("/v1/bookings")
      .set("authorization", attendee.authorization)
      .send({ eventId: event.id })
      .expect(201);

    expect(rebooked.body).toMatchObject({ id: booked.body.id, status: "CONFIRMED" });
    expect(await prisma.booking.count({ where: { userId: attendee.id, eventId: event.id } })).toBe(1);
  });

  it("invalidates a cached event after an update", async () => {
    const organizer = await createUser("ORGANIZER");
    const event = await createEvent(organizer.id);

    const cached = await request(app).get(`/v1/events/${event.id}`).expect(200);
    expect(cached.body.title).toBe("Capstone event");

    await request(app)
      .patch(`/v1/events/${event.id}`)
      .set("authorization", organizer.authorization)
      .send({ title: "Updated after caching" })
      .expect(200);
    const fresh = await request(app).get(`/v1/events/${event.id}`).expect(200);
    expect(fresh.body.title).toBe("Updated after caching");
  });
});
