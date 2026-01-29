import { requestAgentQueue, searchAgentQueue, bookingAgentQueue } from "../queue";
import { prisma } from "../db";
import { AgentType } from "@prisma/client";

export async function triggerRequestAgent(inquiryId: string) {
  const execution = await prisma.agentExecution.create({
    data: {
      inquiryId,
      agentType: AgentType.REQUEST,
      status: "PENDING",
    },
  });

  const job = await requestAgentQueue.add(
    "process-request",
    { inquiryId },
    {
      jobId: `request-${inquiryId}-${Date.now()}`,
    }
  );

  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: { jobId: job.id },
  });

  return { executionId: execution.id, jobId: job.id };
}

export async function triggerSearchAgent(inquiryId: string) {
  const execution = await prisma.agentExecution.create({
    data: {
      inquiryId,
      agentType: AgentType.SEARCH,
      status: "PENDING",
    },
  });

  const job = await searchAgentQueue.add(
    "search-resorts",
    { inquiryId },
    {
      jobId: `search-${inquiryId}-${Date.now()}`,
    }
  );

  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: { jobId: job.id },
  });

  return { executionId: execution.id, jobId: job.id };
}

export async function triggerBookingAgent(
  inquiryId: string,
  resortIds: string[]
) {
  const execution = await prisma.agentExecution.create({
    data: {
      inquiryId,
      agentType: AgentType.BOOKING,
      status: "PENDING",
    },
  });

  const job = await bookingAgentQueue.add(
    "compile-booking",
    { inquiryId, resortIds },
    {
      jobId: `booking-${inquiryId}-${Date.now()}`,
    }
  );

  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: { jobId: job.id },
  });

  return { executionId: execution.id, jobId: job.id };
}

export async function retryAgent(executionId: string) {
  const execution = await prisma.agentExecution.findUnique({
    where: { id: executionId },
    include: { inquiry: true },
  });

  if (!execution) {
    throw new Error("Agent execution not found");
  }

  if (execution.attemptNumber >= execution.maxAttempts) {
    throw new Error("Maximum retry attempts reached");
  }

  // Update attempt count
  await prisma.agentExecution.update({
    where: { id: executionId },
    data: {
      status: "RETRYING",
      attemptNumber: { increment: 1 },
    },
  });

  // Re-trigger based on agent type
  switch (execution.agentType) {
    case AgentType.REQUEST:
      return triggerRequestAgent(execution.inquiryId);
    case AgentType.SEARCH:
      return triggerSearchAgent(execution.inquiryId);
    case AgentType.BOOKING:
      // For booking, we need to get selected resorts
      const selectedResults = await prisma.searchResult.findMany({
        where: { inquiryId: execution.inquiryId, isSelected: true },
        select: { resortId: true },
      });
      return triggerBookingAgent(
        execution.inquiryId,
        selectedResults.map((r) => r.resortId)
      );
    default:
      throw new Error("Unknown agent type");
  }
}
