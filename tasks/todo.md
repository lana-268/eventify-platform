# Eventify v1.0 capstone plan

## Production packaging

- [x] Add a non-root, two-stage Node 24 Docker image that generates Prisma before compiling and runs the API or worker directly.
- [x] Expand Docker Compose to run the API, worker, Postgres test/development database, and Redis with complete environment configuration and health checks.
- [x] Add process-specific graceful shutdown for HTTP, Prisma, Redis, queues, and workers.

## Isolated integration testing and CI

- [x] Configure Vitest to run files serially and force every test onto `eventify_test` before application imports.
- [x] Cover registration/login/refresh rotation, role-gated event creation, full-event waitlisting, cancel-then-rebook, and cache invalidation with awaited Supertest requests.
- [x] Add GitHub Actions services for Postgres and Redis and run migration, lint, typecheck, and the complete test suite.
- [x] Verify Prisma validation/generation, lint, typecheck, Redis-independent local tests, the full CI suite, and production compilation.
- [x] Build and smoke-test the full Compose stack locally when Docker is available.

## Portfolio documentation

- [x] Rewrite the README with the product pitch, architecture, endpoint reference, exact three-command setup, operational commands, decisions/trade-offs, and verified AI usage.
- [x] Add a capstone PR description covering the implementation, verification, AI assistance, deployment evidence, and worker trade-off.

## Provider and GitHub setup (manual)

- [x] Deploy the API on Render with Neon and Upstash secrets, run migrations, seed demo data, and verify health/register/login/booking at the live URL.
- [x] Choose and document honest API-only queueing on Render's free tier.
- [x] Capture both deliberately red and recovered green CI `checks` runs.
- [x] Make the CI `checks` job required on `main`.
