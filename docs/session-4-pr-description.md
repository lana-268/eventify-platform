# Session 4 PR — Authentication and authorization

## What changed

- Added Argon2id credentials, 15-minute HS256 access tokens, and seven-day opaque refresh tokens stored only as SHA-256 hashes.
- Added atomic refresh rotation and replay detection. Replaying a rotated token returns the same generic 401 as an unknown or expired token and revokes every still-active refresh token for that account.
- Applied the route policy matrix. Health plus event list/detail remain public; all other Eventify routes require authentication, with role and ownership checks where appropriate.
- Removed client-controlled identity: event `organizerId` and booking `userId` now always come from the verified token `sub`.
- Added two-organizer fixtures and Supertest proof for cross-organizer and cross-booking 403 responses.

`GET /v1/events` and `GET /v1/events/:id` remain public because event discovery is catalogue data that prospective attendees need before creating an account. No private attendee or booking data is returned by those DTOs. `GET /v1/bookings/:id` is authenticated and limited to the owner, with an ADMIN read bypass for support; cancellation remains owner-only.

The starter model declares `RefreshToken.userId` as PostgreSQL UUID, but this repository's established `User.id` and related foreign keys are text values (`usr-1`, parallel fixtures, and existing migrations). This implementation retains the starter's UUID refresh-row IDs and rotation-chain IDs while using text for `RefreshToken.userId`, so the foreign key is valid without destructively rewriting all prior course data.

## Run and verify

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run typecheck
npm run lint
npm test
npm run test:integration
```

`npm test` is the database-free JWT security gate. `npm run test:integration`
applies the route/ownership/rotation Supertest suite and requires the migrated,
seeded PostgreSQL database above.

Seeded accounts use `Eventify123!`: `organizer@eventify.test`, `organizer-two@eventify.test`, `admin@eventify.test`, and `attendee@eventify.test`.

## AI-assisted OWASP API Security Top 10 audit

Prompt used:

> Audit this endpoint against the OWASP API Security Top 10. For each finding: severity, line, fix.

Triaged findings:

- **Fixed — high — API1 Broken Object Level Authorization — `eventsService.requireEventOwner` / `bookingsService.cancelBooking`:** event mutation originally checked neither `organizerId` nor booking ownership. Service-level owner checks now return 403, with an ADMIN bypass only for event mutations and booking reads.
- **Fixed — high — API2 Broken Authentication — `bookingsController.handleCreateBooking` / `eventsController.handleCreateEvent`:** identity was accepted from `x-user-id` and request bodies. Identity now comes exclusively from a Zod-validated, HS256-pinned JWT.
- **Fixed — high — API2 Broken Authentication — `authService.rotateRefreshToken`:** reusable bearer refresh credentials would have no replay signal. Refresh values are random, hashed at rest, rotated atomically, and reuse revokes active credentials for the account.
- **Fixed — medium — API3 Broken Object Property Level Authorization — `routes/events.eventSchema`:** accepting `organizerId` allowed mass assignment. The request schema rejects it and the controller supplies the verified token subject.
- **Fixed — medium — API8 Security Misconfiguration — `auth/accessToken.signAccessToken` / `verifyAccessToken`:** an algorithm-confusion bug could accept a token using an unintended algorithm. Signing specifies `HS256`, verification allowlists only `HS256`, and parsed claims are never cast.
- **Accepted risk — low — API4 Unrestricted Resource Consumption — `routes/auth.loginSchema`:** per-account login throttling is not included in the core homework. Generic errors and a dummy Argon2 verification prevent enumeration/timing shortcuts; distributed rate limiting is deferred to the deployment session.
- **False positive — cookie readable by JavaScript — `auth/refreshToken.setRefreshTokenCookie`:** the refresh cookie is explicitly `HttpOnly`, `Secure`, `SameSite=Strict`, and path-scoped; the raw token is absent from response JSON and storage.

## Exit ticket

The drill module was forgeable because it decoded attacker-controlled JWT claims without verifying the signature; `jwt.verify(token, secret, { algorithms: ['HS256'] })` is the single call that fixes it.
