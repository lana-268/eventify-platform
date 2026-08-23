import { type Server } from "node:http";

import { redis } from "./redis.ts";
import { waitlistQueue } from "../jobs/waitlist.queue.ts";
import { prisma } from "../lib/prisma.ts";

interface Closable {
  close(): Promise<void>;
}

function installShutdown(processName: string, cleanup: () => Promise<void>): void {
  let shuttingDown = false;
  const handleSignal = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ event: "shutdown_started", process: processName, signal }));
    const forcedExit = setTimeout(() => {
      console.error(JSON.stringify({ event: "shutdown_timeout", process: processName }));
      process.exit(1);
    }, 10_000);
    forcedExit.unref();

    try {
      await cleanup();
      clearTimeout(forcedExit);
      console.log(JSON.stringify({ event: "shutdown_complete", process: processName }));
      process.exitCode = 0;
    } catch (error) {
      clearTimeout(forcedExit);
      console.error(JSON.stringify({ event: "shutdown_failed", process: processName, message: String(error) }));
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

export function registerApiShutdown(server: Server): void {
  installShutdown("api", async () => {
    await closeServer(server);
    await waitlistQueue.close();
    if (redis.isOpen) await redis.quit();
    await prisma.$disconnect();
  });
}

export function registerWorkerShutdown(resources: Closable[]): void {
  installShutdown("worker", async () => {
    await Promise.all(resources.map((resource) => resource.close()));
    await prisma.$disconnect();
  });
}
