import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis";
import { QUEUE_NAMES } from "../lib/queue";
import { processRequestAgent } from "../lib/agents/request-agent";
import { processSearchAgent } from "../lib/agents/search-agent";
import { processBookingAgent } from "../lib/agents/booking-agent";
import type { AgentJobData, BookingAgentJobData } from "../types";

console.log("Starting agent workers...");

// Request Agent Worker
const requestWorker = new Worker<AgentJobData>(
  QUEUE_NAMES.REQUEST_AGENT,
  async (job: Job<AgentJobData>) => {
    console.log(`[Request Agent] Processing job ${job.id} for inquiry ${job.data.inquiryId}`);
    return processRequestAgent(job);
  },
  {
    connection: redis,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Search Agent Worker
const searchWorker = new Worker<AgentJobData>(
  QUEUE_NAMES.SEARCH_AGENT,
  async (job: Job<AgentJobData>) => {
    console.log(`[Search Agent] Processing job ${job.id} for inquiry ${job.data.inquiryId}`);
    return processSearchAgent(job);
  },
  {
    connection: redis,
    concurrency: 3,
  }
);

// Booking Agent Worker
const bookingWorker = new Worker<BookingAgentJobData>(
  QUEUE_NAMES.BOOKING_AGENT,
  async (job: Job<BookingAgentJobData>) => {
    console.log(`[Booking Agent] Processing job ${job.id} for inquiry ${job.data.inquiryId}`);
    return processBookingAgent(job);
  },
  {
    connection: redis,
    concurrency: 2,
    limiter: {
      max: 5,
      duration: 60000,
    },
  }
);

// Event handlers for all workers
const workers = [
  { worker: requestWorker, name: "Request Agent" },
  { worker: searchWorker, name: "Search Agent" },
  { worker: bookingWorker, name: "Booking Agent" },
];

for (const { worker, name } of workers) {
  worker.on("completed", (job) => {
    console.log(`[${name}] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[${name}] Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error(`[${name}] Worker error:`, error);
  });

  worker.on("active", (job) => {
    console.log(`[${name}] Job ${job.id} is now active`);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${name}] Job ${jobId} has stalled`);
  });
}

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down workers...");

  await Promise.all([
    requestWorker.close(),
    searchWorker.close(),
    bookingWorker.close(),
  ]);

  console.log("Workers shut down successfully");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("Agent workers started successfully");
console.log(`- Request Agent: concurrency 5, rate limit 10/s`);
console.log(`- Search Agent: concurrency 3`);
console.log(`- Booking Agent: concurrency 2, rate limit 5/min`);
