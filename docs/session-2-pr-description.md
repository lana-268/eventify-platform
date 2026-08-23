# Session 2: Bookings, Pagination & the Consistency Pass

## What changed

- Added the bookings resource through route, controller, and service layers.
- Added strict Zod validation for booking bodies, booking IDs, and event-list query parameters.
- Prevented a user from creating more than one booking for the same event, regardless of booking status.
- Enforced event capacity using only `CONFIRMED` bookings.
- Added booking lookup and soft cancellation, retaining the booking record with a `CANCELLED` status.
- Added event pagination with `page`, `limit`, and `total` response metadata.
- Added exact venue filtering and inclusive `from`/`to` date filtering before totals and pagination are calculated.
- Standardized validation failures, malformed JSON, expected HTTP errors, and unexpected server errors through centralized middleware.

## API behavior

### Bookings

- `POST /v1/bookings` creates a confirmed booking and returns `201`.
- `GET /v1/bookings/:id` returns a booking or `404` when it does not exist.
- `DELETE /v1/bookings/:id` soft-cancels a booking instead of deleting it.
- Duplicate bookings and events at capacity return `409`.
- Invalid request bodies and non-UUID booking IDs return `400`.

Session 2 uses the temporary fixture identity `usr-1`; verified JWT identity is introduced in Session 4.

### Event discovery

`GET /v1/events` accepts:

- `page`: positive integer, default `1`
- `limit`: integer from `1` to `100`, default `20`
- `venue`: exact venue match
- `from`: inclusive ISO date lower bound
- `to`: inclusive ISO date upper bound

The response shape is:

```json
{
  "data": [],
  "page": 1,
  "limit": 20,
  "total": 0
}
```

Filtering happens before `total` is calculated and before the requested page is sliced, so the pagination metadata describes the filtered result set.

## Consistency decisions

All endpoints follow the route/controller/service layering used by the application. Shared validation middleware parses request bodies, parameters, and queries before controllers use them. Expected errors use a consistent `{ "error", "details" }` JSON shape, malformed JSON returns `400`, and unhandled failures return a generic `500` response without exposing internal details.

Cancellation changes the booking status rather than removing the record. The duplicate rule still considers cancelled bookings, matching the Session 2 requirement that one user cannot create multiple rows for the same event.

## Run and verify

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```

With the server running on port `3011`, verify event pagination and filtering plus booking creation, lookup, duplicate rejection, capacity rejection, cancellation, invalid IDs, invalid bodies, and unknown resources.

Vitest had not yet been introduced in Session 2, so this milestone used the configured static checks and manual endpoint verification. Automated integration coverage was added in later sessions.

## Session boundary

Events and bookings are held in memory in this session, so process restarts reset runtime changes. Session 3 replaces those stores with PostgreSQL repositories and Serializable booking transactions in **Bookings That Survive a Restart**.
