# Session 5 implementation plan

## Redis foundations and caching

- [x] Add validated Redis configuration and separate Redis connections for cache/rate limiting and BullMQ.
- [x] Implement cache-aside event reads with jittered TTLs, versioned list keys, and delete/increment invalidation on writes.
- [x] Record cache hits and misses and emit a structured ratio every 100 lookups.

## Queues and waitlist promotion (Option A)

- [x] Add the booking-email and waitlist-promote queues with retry, exponential backoff, and dead-letter handling.
- [x] Create WAITLISTED bookings when capacity is full while preserving serializable transaction and rebooking behavior.
- [x] Enqueue promotion only when a CONFIRMED booking is cancelled.
- [x] Build a worker that transactionally promotes the oldest waiter after re-checking capacity and then queues its confirmation email.

## Rate limiting and proof

- [x] Apply a strict fixed-window, per-IP Redis limiter to login and a per-user limiter to booking creation.
- [x] Add automated coverage for cache behavior, rate-limit thresholds/recovery, waitlisting, and idempotent promotion.
- [x] Add a scripted rate-limit burst proof and document the chosen limits.
- [x] Document caching-strategy interrogation notes, evidence, and the cache invalidation exit ticket in the PR description.
- [x] Run Prisma validation/generation, typecheck, lint, and tests; review the final diff.

## Session 6 deploy preparation (manual, secrets stay outside Git)

- [ ] Create Render, Neon, and Upstash accounts; provision services and store all three connection strings securely outside the repository.
