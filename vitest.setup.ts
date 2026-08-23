import "dotenv/config";

// Never let tests inherit a development database name or hosted credentials.
const configuredDatabase = process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgresql://eventify:eventify@localhost:5432/eventify";
const testDatabase = new URL(configuredDatabase);
if (testDatabase.hostname !== "localhost" && testDatabase.hostname !== "127.0.0.1") {
  throw new Error("Tests refuse non-local PostgreSQL; set TEST_DATABASE_URL to eventify_test on localhost");
}
testDatabase.pathname = "/eventify_test";
process.env.DATABASE_URL = testDatabase.toString();
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "test-only-secret-at-least-32-characters-long";
process.env.WEB_ORIGIN ??= "http://localhost:5173";
process.env.PORT ??= "3011";
