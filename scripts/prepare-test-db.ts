import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import pg from "pg";

const configuredUrl = process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgresql://eventify:eventify@localhost:5432/eventify";
const sourceUrl = new URL(configuredUrl);
if (sourceUrl.hostname !== "localhost" && sourceUrl.hostname !== "127.0.0.1") {
  throw new Error("test:prepare refuses non-local PostgreSQL; set TEST_DATABASE_URL to eventify_test on localhost");
}
const maintenanceUrl = new URL(sourceUrl);
maintenanceUrl.pathname = "/postgres";
maintenanceUrl.search = "";
const testUrl = new URL(sourceUrl);
testUrl.pathname = "/eventify_test";
const client = new pg.Client({ connectionString: maintenanceUrl.toString() });

try {
  await client.connect();
  const existing = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    ["eventify_test"],
  );
  if (!existing.rows[0]?.exists) await client.query("CREATE DATABASE eventify_test");
} finally {
  await client.end();
}

const prismaCli = fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url));
const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    REDIS_URL: "redis://localhost:6379",
    JWT_ACCESS_SECRET: "test-only-secret-at-least-32-characters-long",
    WEB_ORIGIN: "http://localhost:5173",
    PORT: "3011",
  },
  stdio: "inherit",
});
if (migration.status !== 0) process.exitCode = migration.status ?? 1;
