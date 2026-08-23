import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Every integration file truncates the same eventify_test database.
    // Parallel files would race by deleting one another's fixtures.
    fileParallelism: false,
    // This must run before test-module imports because config.ts parses env eagerly.
    setupFiles: ["./vitest.setup.ts"],
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
});
