import { Queue } from "bullmq";

import { queueBackend } from "../infra/queue-backend.ts";

export interface ConfirmationEmailJob {
  bookingId: string;
}

export const emailQueue = new Queue<ConfirmationEmailJob>("booking-email", {
  connection: queueBackend,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

export const emailDeadLetterQueue = new Queue<ConfirmationEmailJob>("booking-email-dead-letter", {
  connection: queueBackend,
});
