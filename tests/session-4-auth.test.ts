import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.ts";
import { config } from "../src/config.ts";
import { hashRefreshToken } from "../src/auth/refreshToken.ts";
import { prisma } from "../src/lib/prisma.ts";
import { getRedis, redis } from "../src/infra/redis.ts";
import { waitlistQueue } from "../src/jobs/waitlist.queue.ts";

const app = createApp();
const password = "Eventify123!";
const organizerTwoEventId = "10000000-0000-4000-8000-000000000002";
const bookingEventId = "10000000-0000-4000-8000-000000000003";

async function login(email: string): Promise<{ accessToken: string; cookie: string }> {
  const response = await request(app).post("/v1/auth/login").send({ email, password }).expect(200);
  const setCookie = response.headers["set-cookie"] as unknown;
  if (!Array.isArray(setCookie) || typeof setCookie[0] !== "string") {
    throw new Error("Login did not set a refresh cookie");
  }
  return { accessToken: response.body.accessToken as string, cookie: setCookie[0].split(";", 1)[0]! };
}

beforeAll(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const users = [
    { id: "auth-org-1", email: "auth-org-1@eventify.test", name: "Organizer One", role: "ORGANIZER" as const },
    { id: "auth-org-2", email: "auth-org-2@eventify.test", name: "Organizer Two", role: "ORGANIZER" as const },
    { id: "auth-admin", email: "auth-admin@eventify.test", name: "Admin", role: "ADMIN" as const },
    { id: "auth-attendee", email: "auth-attendee@eventify.test", name: "Attendee", role: "ATTENDEE" as const },
  ];
  for (const user of users) {
    const data = { ...user, passwordHash };
    await prisma.user.upsert({ where: { id: user.id }, update: data, create: data });
  }
  await prisma.event.upsert({
    where: { id: organizerTwoEventId },
    update: { organizerId: "auth-org-2" },
    create: {
      id: organizerTwoEventId,
      title: "Ownership fixture",
      description: "Owned by the second organizer",
      startsAt: new Date("2027-01-01T12:00:00.000Z"),
      capacity: 10,
      priceCents: 0,
      organizerId: "auth-org-2",
    },
  });
  await prisma.event.upsert({
    where: { id: bookingEventId },
    update: { organizerId: "auth-org-1" },
    create: {
      id: bookingEventId,
      title: "Booking fixture",
      description: "Available to authenticated attendees",
      startsAt: new Date("2027-01-02T12:00:00.000Z"),
      capacity: 10,
      priceCents: 0,
      organizerId: "auth-org-1",
    },
  });
  await prisma.refreshToken.deleteMany({ where: { userId: { startsWith: "auth-" } } });
  await prisma.booking.deleteMany({ where: { userId: "auth-attendee", eventId: bookingEventId } });
});

beforeEach(async () => {
  await (await getRedis()).flushDb();
});

afterAll(async () => {
  await waitlistQueue.close();
  if (redis.isOpen) await redis.quit();
  await prisma.$disconnect();
});

describe("Session 4 route policy", () => {
  it("keeps event discovery public and rejects unauthenticated mutations", async () => {
    await request(app).get("/v1/events").expect(200);
    await request(app).post("/v1/events").send({}).expect(401);
    await request(app).post("/v1/bookings").send({ eventId: bookingEventId }).expect(401);
  });

  it("rejects ATTENDEE event creation and accepts ORGANIZER creation", async () => {
    const attendee = await login("auth-attendee@eventify.test");
    await request(app)
      .post("/v1/events")
      .set("authorization", `Bearer ${attendee.accessToken}`)
      .send({ title: "No", description: "No", startsAt: "2027-02-01T12:00:00.000Z", capacity: 1, priceCents: 0 })
      .expect(403);

    const organizer = await login("auth-org-1@eventify.test");
    const created = await request(app)
      .post("/v1/events")
      .set("authorization", `Bearer ${organizer.accessToken}`)
      .send({ title: "Authorized", description: "Created by token subject", startsAt: "2027-02-01T12:00:00.000Z", capacity: 1, priceCents: 0 })
      .expect(201);
    expect(created.body.organizerId).toBe("auth-org-1");

    const admin = await login("auth-admin@eventify.test");
    const adminCreated = await request(app)
      .post("/v1/events")
      .set("authorization", `Bearer ${admin.accessToken}`)
      .send({ title: "Admin event", description: "Created by an admin", startsAt: "2027-02-02T12:00:00.000Z", capacity: 1, priceCents: 0 })
      .expect(201);
    expect(adminCreated.body.organizerId).toBe("auth-admin");

    await request(app)
      .delete(`/v1/events/${created.body.id as string}`)
      .set("authorization", `Bearer ${organizer.accessToken}`)
      .expect(200);
    await request(app)
      .delete(`/v1/events/${adminCreated.body.id as string}`)
      .set("authorization", `Bearer ${admin.accessToken}`)
      .expect(200);
  });

  it("lets any authenticated user book", async () => {
    const attendee = await login("auth-attendee@eventify.test");
    const response = await request(app)
      .post("/v1/bookings")
      .set("authorization", `Bearer ${attendee.accessToken}`)
      .send({ eventId: bookingEventId })
      .expect(201);
    expect(response.body.userId).toBe("auth-attendee");

    const organizer = await login("auth-org-1@eventify.test");
    await request(app)
      .delete(`/v1/bookings/${response.body.id as string}`)
      .set("authorization", `Bearer ${organizer.accessToken}`)
      .expect(403);
    await request(app)
      .delete(`/v1/bookings/${response.body.id as string}`)
      .set("authorization", `Bearer ${attendee.accessToken}`)
      .expect(200);
  });

  it("returns 403 when one organizer edits the other organizer's event", async () => {
    const organizerOne = await login("auth-org-1@eventify.test");
    await request(app)
      .patch(`/v1/events/${organizerTwoEventId}`)
      .set("authorization", `Bearer ${organizerOne.accessToken}`)
      .send({ title: "Stolen" })
      .expect(403);
  });
});

describe("refresh-token rotation", () => {
  it("uses one generic response for unknown accounts and wrong passwords", async () => {
    const unknown = await request(app)
      .post("/v1/auth/login")
      .send({ email: "missing@eventify.test", password: "wrong" })
      .expect(401);
    const wrongPassword = await request(app)
      .post("/v1/auth/login")
      .send({ email: "auth-admin@eventify.test", password: "wrong" })
      .expect(401);
    expect(unknown.body).toEqual(wrongPassword.body);
  });

  it("rotates once, stores hashes, sets a strict cookie, and rejects replay", async () => {
    const first = await login("auth-admin@eventify.test");
    const rawFirst = first.cookie.slice(first.cookie.indexOf("=") + 1);
    const storedFirst = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(rawFirst) } });
    expect(storedFirst).not.toBeNull();
    expect(storedFirst?.tokenHash).not.toBe(rawFirst);

    const rotated = await request(app)
      .post("/v1/auth/refresh")
      .set("origin", new URL(config.WEB_ORIGIN).origin)
      .set("cookie", first.cookie)
      .expect(200);
    expect(rotated.body.accessToken).toEqual(expect.any(String));
    const setCookie = rotated.headers["set-cookie"] as unknown as string[];
    expect(setCookie[0]).toContain("HttpOnly");
    expect(setCookie[0]).toContain("Secure");
    expect(setCookie[0]).toContain("SameSite=Strict");
    expect(setCookie[0]).toContain("Path=/v1/auth/refresh");

    const replay = await request(app)
      .post("/v1/auth/refresh")
      .set("origin", new URL(config.WEB_ORIGIN).origin)
      .set("cookie", first.cookie)
      .expect(401);
    expect(replay.body.error).toBe("Invalid refresh token");
    expect(await prisma.refreshToken.count({ where: { userId: "auth-admin", revokedAt: null } })).toBe(0);
  });
});
