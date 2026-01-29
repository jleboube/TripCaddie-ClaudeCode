import { Job } from "bullmq";
import { prisma } from "../db";
import { sendBookingRequest } from "../email";
import { decryptPII } from "../encryption";
import type { BookingAgentJobData, AgentResult } from "@/types";

export async function processBookingAgent(
  job: Job<BookingAgentJobData>
): Promise<AgentResult> {
  const { inquiryId, resortIds } = job.data;
  const startTime = Date.now();

  // Update execution status
  await prisma.agentExecution.updateMany({
    where: { jobId: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  // Update inquiry status
  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "BOOKING_IN_PROGRESS" },
  });

  try {
    // Fetch inquiry with search results
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        searchResults: {
          where: {
            resortId: { in: resortIds },
          },
          include: {
            resort: true,
          },
        },
      },
    });

    if (!inquiry) {
      throw new Error(`Inquiry not found: ${inquiryId}`);
    }

    if (inquiry.searchResults.length === 0) {
      throw new Error("No matching search results found for selected resorts");
    }

    // Decrypt contact info
    const contactName = decryptPII(inquiry.contactName);
    const contactEmail = decryptPII(inquiry.contactEmail);
    const contactPhone = inquiry.contactPhone
      ? decryptPII(inquiry.contactPhone)
      : undefined;

    const results: Array<{
      resortId: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Send booking request to each selected resort
    for (const searchResult of inquiry.searchResults) {
      const resort = searchResult.resort;

      // Compile booking data
      const bookingData = {
        inquiryNumber: inquiry.inquiryNumber,
        contactName,
        contactEmail,
        contactPhone,
        arrivalDate: inquiry.arrivalDate,
        departureDate: inquiry.departureDate,
        numberOfNights: inquiry.numberOfNights,
        numberOfGolfers: inquiry.numberOfGolfers,
        roundsPerGolfer: inquiry.roundsPerGolfer,
        numberOfRooms: inquiry.numberOfRooms,
        roomType: inquiry.roomType ?? undefined,
        specialRequests: inquiry.specialRequests ?? undefined,
        resortName: resort.name,
        estimatedTotal: searchResult.estimatedTotal
          ? Number(searchResult.estimatedTotal)
          : undefined,
        matchScore: Number(searchResult.matchScore),
      };

      // Get resort emails
      const resortEmails = [
        resort.primaryEmail,
        ...resort.secondaryEmails,
      ].filter(Boolean);

      // Send email
      const emailResult = await sendBookingRequest(
        bookingData,
        resortEmails
      );

      // Create booking request record
      await prisma.bookingRequest.create({
        data: {
          inquiryId,
          resortId: resort.id,
          bookingData: bookingData as object,
          sentToEmails: resortEmails,
          deliveryStatus: emailResult.success ? "SENT" : "FAILED",
          sentAt: emailResult.success ? new Date() : null,
          emailMessageId: emailResult.messageId,
          failureReason: emailResult.success ? null : emailResult.error,
        },
      });

      // Mark search result as selected
      await prisma.searchResult.update({
        where: { id: searchResult.id },
        data: { isSelected: true },
      });

      results.push({
        resortId: resort.id,
        success: emailResult.success,
        messageId: emailResult.messageId,
        error: emailResult.error,
      });
    }

    // Determine overall success
    const successCount = results.filter((r) => r.success).length;
    const allSuccess = successCount === results.length;

    // Update inquiry status
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: {
        status: allSuccess ? "BOOKING_REQUEST_SENT" : "FAILED",
        completedAt: allSuccess ? new Date() : null,
      },
    });

    // Mark execution complete
    const durationMs = Date.now() - startTime;
    await prisma.agentExecution.updateMany({
      where: { jobId: job.id },
      data: {
        status: allSuccess ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        durationMs,
        output: { results, successCount, totalCount: results.length },
        errorMessage: allSuccess
          ? null
          : `${results.length - successCount} of ${results.length} emails failed`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "BOOKING_AGENT_COMPLETED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: {
          resortCount: results.length,
          successCount,
          durationMs,
        },
      },
    });

    return {
      success: allSuccess,
      data: { results, successCount, totalCount: results.length },
      errors: allSuccess
        ? undefined
        : results.filter((r) => !r.success).map((r) => r.error || "Unknown error"),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

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

    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: "FAILED" },
    });

    await prisma.auditLog.create({
      data: {
        action: "BOOKING_AGENT_FAILED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: { error: errorMessage, durationMs },
      },
    });

    throw error;
  }
}
