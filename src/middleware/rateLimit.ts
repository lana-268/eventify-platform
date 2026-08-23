import { type NextFunction, type Request, type Response } from "express";

import { getRedis } from "../infra/redis.ts";
import { HttpError } from "../utils/httpError.ts";

const fixedWindowScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  identity: (request: Request, response: Response) => string;
}

export function rateLimit(options: RateLimitOptions) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    try {
      const identity = options.identity(request, response);
      const window = Math.floor(Date.now() / options.windowMs);
      const path = `${request.baseUrl}${request.path}`;
      const key = `rl:${identity}:${path}:${window}`;
      const count = await (await getRedis()).eval(fixedWindowScript, {
        keys: [key],
        arguments: [String(options.windowMs)],
      });
      response.setHeader("RateLimit-Limit", options.max);
      response.setHeader("RateLimit-Remaining", Math.max(0, options.max - Number(count)));
      if (Number(count) > options.max) {
        next(new HttpError(429, "Too many requests"));
        return;
      }
      next();
    } catch (error) {
      console.error(JSON.stringify({ event: "rate_limit_bypass", message: String(error) }));
      next();
    }
  };
}
