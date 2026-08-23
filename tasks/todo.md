# Eventify v1.0 capstone plan

## Production packaging

- [ ] Add a non-root, two-stage Node 24 Docker image that generates Prisma before compiling and runs the API or worker directly.
- [ ] Expand Docker Compose to run the API, worker, Postgres test/development database, and Redis with complete environment configuration and health checks.
- [ ] Add process-specific graceful shutdown for HTTP, Prisma, Redis, queues, and workers.

## Isolated integration testing and CI

- [ ] Configure Vitest to run files serially and force every test onto `eventify_test` before application imports.
- [ ] Cover registration/login/refresh rotation, role-gated event creation, full-event waitlisting, cancel-then-rebook, and cache invalidation with awaited Supertest requests.
- [ ] Add GitHub Actions services for Postgres and Redis and run migration, lint, typecheck, and the complete test suite.
- [ ] Verify Prisma validation/generation, lint, typecheck, tests, and production compilation locally.

## Portfolio documentation

- [ ] Rewrite the README with the product pitch, architecture, endpoint reference, exact three-command setup, operational commands, decisions/trade-offs, and verified AI usage.
- [ ] Add a capstone PR description covering the implementation, verification, AI assistance, deployment evidence placeholders, and worker trade-off.

## Provider and GitHub setup (manual)

- [ ] Deploy the API on Render with Neon and Upstash secrets, run migrations, seed demo data, and verify health/register/login/booking at the live URL.
- [ ] Choose and document paid worker deployment or honest API-only queueing on Render's free tier.
- [ ] Make the CI `checks` job required on `main` and capture both deliberately red and final green PR checks.
