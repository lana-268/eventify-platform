import { getRedis } from "./redis.ts";

const baseTtlSeconds = 60;
const jitterSeconds = 10;

let hits = 0;
let misses = 0;

function record(hit: boolean): void {
  if (hit) hits += 1;
  else misses += 1;
  const lookups = hits + misses;
  if (lookups % 100 === 0) {
    console.log(JSON.stringify({ event: "cache_metrics", hits, misses, ratio: hits / lookups }));
  }
}

function ttlWithJitter(): number {
  return baseTtlSeconds + Math.floor(Math.random() * (jitterSeconds + 1));
}

export async function readThrough<T>(key: string, load: () => Promise<T>): Promise<T> {
  let client: Awaited<ReturnType<typeof getRedis>>;
  try {
    client = await getRedis();
    const cached = await client.get(key);
    if (cached !== null) {
      record(true);
      return JSON.parse(cached) as T;
    }
    record(false);
  } catch (error) {
    console.error(JSON.stringify({ event: "cache_bypass", key, message: String(error) }));
    return load();
  }

  const value = await load();
  const serialized = JSON.stringify(value);
  if (serialized !== undefined) {
    try {
      await client.set(key, serialized, { EX: ttlWithJitter() });
    } catch (error) {
      console.error(JSON.stringify({ event: "cache_write_failed", key, message: String(error) }));
    }
  }
  return value;
}

export async function deleteCacheKey(key: string): Promise<void> {
  try {
    await (await getRedis()).del(key);
  } catch (error) {
    console.error(JSON.stringify({ event: "cache_invalidation_failed", key, message: String(error) }));
  }
}

export async function currentEventListVersion(): Promise<string> {
  try {
    return await (await getRedis()).get("events:list:v") ?? "0";
  } catch (error) {
    console.error(JSON.stringify({ event: "cache_version_bypass", message: String(error) }));
    return "uncached";
  }
}

export async function invalidateEventLists(): Promise<void> {
  try {
    await (await getRedis()).incr("events:list:v");
  } catch (error) {
    console.error(JSON.stringify({ event: "cache_invalidation_failed", key: "events:list:v", message: String(error) }));
  }
}
