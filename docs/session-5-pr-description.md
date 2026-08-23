# Session 5 — caching, queues, and background jobs

## What changed

- Added cache-aside event detail/list reads with 60–70 second TTLs, delete-on-write detail invalidation, and a single list-version `INCR` per event write.
- Added structured cache metrics every 100 reads. The deterministic cache test produces `{"event":"cache_metrics","hits":99,"misses":1,"ratio":0.99}`.
- Chose Option A: full events now create `WAITLISTED` bookings. Cancelling a confirmed booking queues a promotion; the worker re-checks capacity in a serializable transaction, promotes the oldest waiter, and queues its confirmation email.
- Added fixed-window Redis limits: login is 5 attempts/minute per IP to slow credential attacks; booking creation is 10 attempts/10 seconds per authenticated user to absorb accidental retries and bursts without coupling users behind one NAT.

## Proof

Run the API and worker with Redis and Postgres available:

```text
npm run dev
npm run worker
```

Then prove the booking threshold and recovery with an existing user's credentials kept in shell environment variables:

```text
EVENTIFY_PROOF_EMAIL=... EVENTIFY_PROOF_PASSWORD=... npm run proof:rate-limit
```

The script asserts that requests 1–10 reach the route, request 11 returns 429, and the first request after the fixed window is accepted. `npm run test:integration` covers cache reuse, per-identity rate-limit isolation/recovery, waitlist ordering, and idempotent promotion.

## AI caching-strategy interrogation notes

The first-pass advice was too eager to SET the newly updated event into cache, suggested deleting list keys by scanning a pattern, and treated the BullMQ connection as reusable application Redis state. I caught those issues by walking concurrent timelines and the stated key/connection contract: a reader that began before the database commit can overwrite a writer's eager SET with stale data; pattern invalidation is O(number of keys) and easy to make incomplete; and a worker needs blocking/duplicated connections separate from the cache client. The resulting design deletes `event:{id}`, increments `events:list:v` once, adds TTL jitter, and gives BullMQ its own node-redis client adapter.

## Exit ticket

`updateEvent` deletes the cache key instead of setting the fresh value because deletion makes a concurrent stale reader's race window bounded by the TTL and lets the next read repopulate from the database without the write path having to reproduce cache serialization logic.

## Manual deploy prep

Render, Neon, and Upstash accounts and their three connection strings must be provisioned by the repository owner; store the secrets outside Git and verify each connection before Session 6.
