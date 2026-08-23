# Session 5 implementation plan

## Redis foundations and caching

- [ ] Add validated Redis configuration and separate Redis connections for cache/rate limiting and BullMQ.
- [ ] Implement cache-aside event reads with jittered TTLs, versioned list keys, and delete/increment invalidation on writes.
- [ ] Record cache hits and misses and emit a structured ratio every 100 lookups.

## Queues and waitlist promotion (Option A)

- [ ] Add the booking-email and waitlist-promote queues with retry, exponential backoff, and dead-letter handling.
- [ ] Create WAITLISTED bookings when capacity is full while preserving serializable transaction and rebooking behavior.
- [ ] Enqueue promotion only when a CONFIRMED booking is cancelled.
- [ ] Build a worker that transactionally promotes the oldest waiter after re-checking capacity and then queues its confirmation email.

## Rate limiting and proof

- [ ] Apply a strict fixed-window, per-IP Redis limiter to login and a per-user limiter to booking creation.
- [ ] Add automated coverage for cache behavior, rate-limit thresholds/recovery, waitlisting, and idempotent promotion.
- [ ] Add a scripted rate-limit burst proof and document the chosen limits.
- [ ] Document caching-strategy interrogation notes, evidence, and the cache invalidation exit ticket in the PR description.
- [ ] Run Prisma validation/generation, typecheck, lint, and tests; review the final diff.

## Session 6 deploy preparation (manual, secrets stay outside Git)

- [ ] Create Render, Neon, and Upstash accounts; provision services and store all three connection strings securely outside the repository.
