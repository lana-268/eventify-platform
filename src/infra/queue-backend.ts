import { createNodeRedisClient } from "bullmq";
import { createClient } from "redis";

import { config } from "../config.ts";

// BullMQ owns and duplicates this connection. Never reuse the cache/limiter client.
const rawQueueClient = createClient({
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 1_000,
    reconnectStrategy: (retries) => retries > 3 ? new Error("Queue Redis reconnect limit reached") : retries * 100,
  },
});
rawQueueClient.on("error", (error) => {
  console.error(JSON.stringify({ event: "queue_redis_error", message: String(error) }));
});

export const queueBackend = createNodeRedisClient(rawQueueClient);
