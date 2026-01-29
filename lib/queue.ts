import { Queue } from "bullmq";
import type { AgentJobData, BookingAgentJobData } from "@/types";

export const QUEUE_NAMES = {
  REQUEST_AGENT: "request-agent",
  SEARCH_AGENT: "search-agent",
  BOOKING_AGENT: "booking-agent",
} as const;

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 86400, // 24 hours
    count: 1000,
  },
  removeOnFail: {
    age: 604800, // 7 days
  },
};

// Lazy-loaded queue instances
let _requestAgentQueue: Queue<AgentJobData> | null = null;
let _searchAgentQueue: Queue<AgentJobData> | null = null;
let _bookingAgentQueue: Queue<BookingAgentJobData> | null = null;

function getRedisConnection() {
  // Dynamic import to avoid build-time connection
  return require("./redis").redis;
}

export function getRequestAgentQueue(): Queue<AgentJobData> {
  if (!_requestAgentQueue) {
    _requestAgentQueue = new Queue<AgentJobData>(QUEUE_NAMES.REQUEST_AGENT, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _requestAgentQueue;
}

export function getSearchAgentQueue(): Queue<AgentJobData> {
  if (!_searchAgentQueue) {
    _searchAgentQueue = new Queue<AgentJobData>(QUEUE_NAMES.SEARCH_AGENT, {
      connection: getRedisConnection(),
      defaultJobOptions,
    });
  }
  return _searchAgentQueue;
}

export function getBookingAgentQueue(): Queue<BookingAgentJobData> {
  if (!_bookingAgentQueue) {
    _bookingAgentQueue = new Queue<BookingAgentJobData>(
      QUEUE_NAMES.BOOKING_AGENT,
      {
        connection: getRedisConnection(),
        defaultJobOptions,
      }
    );
  }
  return _bookingAgentQueue;
}

// Backwards-compatible exports (lazy getters)
export const requestAgentQueue = {
  add: (...args: Parameters<Queue<AgentJobData>["add"]>) =>
    getRequestAgentQueue().add(...args),
  getJobCounts: () => getRequestAgentQueue().getJobCounts(),
};

export const searchAgentQueue = {
  add: (...args: Parameters<Queue<AgentJobData>["add"]>) =>
    getSearchAgentQueue().add(...args),
  getJobCounts: () => getSearchAgentQueue().getJobCounts(),
};

export const bookingAgentQueue = {
  add: (...args: Parameters<Queue<BookingAgentJobData>["add"]>) =>
    getBookingAgentQueue().add(...args),
  getJobCounts: () => getBookingAgentQueue().getJobCounts(),
};

export async function getQueueStats() {
  try {
    const [requestStats, searchStats, bookingStats] = await Promise.all([
      getRequestAgentQueue().getJobCounts(),
      getSearchAgentQueue().getJobCounts(),
      getBookingAgentQueue().getJobCounts(),
    ]);

    return {
      request: requestStats,
      search: searchStats,
      booking: bookingStats,
    };
  } catch {
    return null;
  }
}
