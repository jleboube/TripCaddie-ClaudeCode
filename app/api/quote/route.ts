import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { triggerRequestAgent } from "@/lib/agents";
import { generateInquiryNumber, calculateNights } from "@/lib/utils";
import { encryptPII } from "@/lib/encryption";
import { quoteFormSchema } from "@/lib/validation";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = quoteFormSchema.parse(body);

    // Calculate nights
    const numberOfNights = calculateNights(
      validatedData.arrivalDate,
      validatedData.departureDate
    );

    // Generate inquiry number
    const inquiryNumber = await generateInquiryNumber();

    // Create inquiry with encrypted PII
    const inquiry = await prisma.inquiry.create({
      data: {
        inquiryNumber,
        contactName: encryptPII(validatedData.contactName),
        contactEmail: encryptPII(validatedData.contactEmail),
        contactPhone: encryptPII(validatedData.contactPhone),
        destination: validatedData.destination,
        arrivalDate: validatedData.arrivalDate,
        departureDate: validatedData.departureDate,
        numberOfNights,
        numberOfGolfers: validatedData.numberOfGolfers,
        roundsPerGolfer: validatedData.roundsPerGolfer,
        numberOfRooms: validatedData.numberOfRooms,
        roomType: validatedData.roomType || "double",
        preferredResorts: validatedData.preferredResorts || [],
        budgetMin: validatedData.budgetMin,
        budgetMax: validatedData.budgetMax,
        specialRequests: validatedData.specialRequests,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0] ||
          request.headers.get("x-real-ip") ||
          null,
        userAgent: request.headers.get("user-agent"),
        source: "web",
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "INQUIRY_CREATED",
        entityType: "Inquiry",
        entityId: inquiry.id,
        metadata: {
          inquiryNumber,
          source: "web",
        },
      },
    });

    // Trigger Request Agent asynchronously
    await triggerRequestAgent(inquiry.id);

    return NextResponse.json(
      {
        success: true,
        inquiryId: inquiry.id,
        inquiryNumber: inquiry.inquiryNumber,
        message: "Your quote request has been submitted successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Quote submission error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "An error occurred while processing your request. Please try again.",
      },
      { status: 500 }
    );
  }
}
