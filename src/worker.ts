import { type Job, Worker } from "bullmq";

import { queueBackend } from "./infra/queue-backend.ts";
import { registerWorkerShutdown } from "./infra/shutdown.ts";
import { emailDeadLetterQueue, emailQueue, type ConfirmationEmailJob } from "./jobs/email.queue.ts";
import { promoteOldestWaitlisted } from "./jobs/promoteWaitlist.ts";
import { type WaitlistPromotionJob } from "./jobs/waitlist.queue.ts";
import { sendBookingConfirmation } from "./services/mailer.ts";

const emailWorker = new Worker<ConfirmationEmailJob>(
  "booking-email",
  async (job) => sendBookingConfirmation(job.data.bookingId),
  { connection: queueBackend },
);

const waitlistWorker = new Worker<WaitlistPromotionJob>(
  "waitlist-promote",
  async (job) => {
    const bookingId = await promoteOldestWaitlisted(job.data.eventId);
    if (bookingId) await emailQueue.add("confirmation", { bookingId });
  },
  { connection: queueBackend },
);

emailWorker.on("failed", async (job: Job<ConfirmationEmailJob> | undefined, error) => {
  if (!job || job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await emailDeadLetterQueue.add("confirmation", job.data, {
    jobId: `failed:${job.id ?? job.data.bookingId}`,
  });
  console.error(JSON.stringify({ event: "email_dead_lettered", jobId: job.id, message: error.message }));
});

for (const worker of [emailWorker, waitlistWorker]) {
  worker.on("error", (error) => {
    console.error(JSON.stringify({ event: "worker_error", message: error.message }));
  });
}

registerWorkerShutdown([emailWorker, waitlistWorker, emailQueue, emailDeadLetterQueue]);

console.log(JSON.stringify({ event: "worker_ready", queues: ["booking-email", "waitlist-promote"] }));
