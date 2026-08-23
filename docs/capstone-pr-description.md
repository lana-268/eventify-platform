# capstone: Eventify v1.0

## What I built

Eventify v1.0 combines authenticated event management, Serializable booking and waitlist transactions, Redis caching and rate limiting, BullMQ background jobs, an isolated integration suite, a non-root production image, a full local Compose stack, graceful shutdown, and CI quality gates.

## Verification

- [x] Prisma schema validation and client generation
- [x] ESLint
- [x] Strict TypeScript typecheck
- [x] Production TypeScript build
- [ ] Full PostgreSQL + Redis test suite locally
- [x] Green GitHub Actions `checks` job ([branch run 32642767093](https://github.com/lana-268/eventify-platform/actions/runs/32642767093))
- [ ] Deliberately broken commit screenshot showing a red `checks` job
- [ ] `GET <LIVE_URL>/health` returns 200
- [ ] Live signup, login, event listing, and confirmed booking demonstrated

The required capstone integration suite covers signup/login and refresh rotation, ORGANIZER-versus-ATTENDEE event creation, full-event `WAITLISTED` behavior, cancel-then-rebook row reactivation, and cache invalidation. Vitest forces `eventify_test` before imports and disables file parallelism.

## AI assistance

AI drafted portions of the Docker/Compose configuration, graceful-shutdown orchestration, integration-test scaffolding, CI workflow, and documentation. I verified the work by tracing resource ownership per process, inspecting emitted imports, checking every Supertest chain is awaited, running static gates, and exercising the database/Redis suite and deployed API before checking their evidence boxes. I rejected or corrected drafts that risked test access to the development database, omitted generated Prisma artifacts from the runtime image, or claimed provider evidence that had not run.

## Deployment and worker trade-off

**Live URL:** `<LIVE_URL>`

Render uses the Docker image with pre-deploy command `npx prisma migrate deploy`; Neon supplies `DATABASE_URL`, Upstash supplies the Redis-protocol `REDIS_URL`, and the remaining secrets are Render environment variables. Demo data is seeded before grading.

Render's free tier has no background-worker service type. If the API-only option is used, jobs remain in Upstash until `node dist/worker.js` runs elsewhere; the API and all synchronous booking behavior remain available. If a paid worker is provisioned, record it here before submission.
