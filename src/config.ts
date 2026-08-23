import "dotenv/config";

import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3011),
  JWT_ACCESS_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url(),
});

export const config = environmentSchema.parse(process.env);
