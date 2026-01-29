import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { triggerSearchAgent } from "./index";
import { validateAndNormalizeInquiry } from "../validation";
import { decryptPII } from "../encryption";
import type { AgentJobData, AgentResult } from "@/types";

export async function processRequestAgent(
  job: Job<AgentJobData>
): Promise<AgentResult> {
  const { inquiryId } = job.data;
  const startTime = Date.now();

  // Update execution status to RUNNING
  await prisma.agentExecution.updateMany({
    where: { jobId: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  // Update inquiry status
  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "PENDING" },
  });

  try {
    // Fetch inquiry
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new Error(`Inquiry not found: ${inquiryId}`);
    }

    // Decrypt PII for processing
    const decryptedInquiry = {
      contactName: decryptPII(inquiry.contactName),
      contactEmail: decryptPII(inquiry.contactEmail),
      contactPhone: decryptPII(inquiry.contactPhone),
      destination: inquiry.destination,
      arrivalDate: inquiry.arrivalDate,
      departureDate: inquiry.departureDate,
      numberOfNights: inquiry.numberOfNights,
      numberOfGolfers: inquiry.numberOfGolfers,
      roundsPerGolfer: inquiry.roundsPerGolfer,
      numberOfRooms: inquiry.numberOfRooms,
      roomType: inquiry.roomType,
      preferredResorts: inquiry.preferredResorts,
      budgetMin: inquiry.budgetMin ? Number(inquiry.budgetMin) : null,
      budgetMax: inquiry.budgetMax ? Number(inquiry.budgetMax) : null,
      specialRequests: inquiry.specialRequests,
    };

    // Validate and normalize
    const { normalizedData, errors } = validateAndNormalizeInquiry(decryptedInquiry);

    // Determine new status based on validation
    const newStatus = errors.length > 0 ? "FAILED" : "REQUEST_ACCEPTED";

    // Update inquiry with normalized data and status
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        normalizedData: normalizedData as object,
        validationErrors: errors.length > 0 ? errors : Prisma.DbNull,
        status: newStatus,
      },
    });

    // Mark execution complete
    const durationMs = Date.now() - startTime;
    await prisma.agentExecution.updateMany({
      where: { jobId: job.id },
      data: {
        status: errors.length > 0 ? "FAILED" : "COMPLETED",
        completedAt: new Date(),
        durationMs,
        output: { normalizedData: normalizedData as object, errors } as Prisma.InputJsonValue,
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "REQUEST_AGENT_COMPLETED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: {
          success: errors.length === 0,
          errorCount: errors.length,
          durationMs,
        },
      },
    });

    // Trigger Search Agent if validation passed
    if (errors.length === 0) {
      await triggerSearchAgent(inquiryId);
    }

    return {
      success: errors.length === 0,
      data: { normalizedData },
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    // Mark execution failed
    await prisma.agentExecution.updateMany({
      where: { jobId: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    });

    // Update inquiry status
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: "FAILED" },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "REQUEST_AGENT_FAILED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: { error: errorMessage, durationMs },
      },
    });

    throw error;
  }
}
