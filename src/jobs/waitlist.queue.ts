import { Queue } from "bullmq";

import { queueBackend } from "../infra/queue-backend.ts";

export interface WaitlistPromotionJob {
  eventId: string;
}

export const waitlistQueue = new Queue<WaitlistPromotionJob>("waitlist-promote", {
  connection: queueBackend,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

export async function enqueueWaitlistPromotion(eventId: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Timed out enqueueing waitlist promotion")), 500);
  });
  try {
    await Promise.race([waitlistQueue.add("promote", { eventId }), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
