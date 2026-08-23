import { createClient } from "redis";

import { config } from "../config.ts";

export const redis = createClient({
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 1_000,
    reconnectStrategy: (retries) => retries > 3 ? new Error("Redis reconnect limit reached") : retries * 100,
  },
});

redis.on("error", (error) => {
  console.error(JSON.stringify({ event: "redis_error", message: String(error) }));
});

let connection: Promise<typeof redis> | undefined;

export function getRedis(): Promise<typeof redis> {
  if (redis.isReady) return Promise.resolve(redis);
  connection ??= redis.connect().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
