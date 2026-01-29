import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptPII } from "@/lib/encryption";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      include: {
        searchResults: {
          include: {
            resort: {
              select: {
                id: true,
                name: true,
                city: true,
                state: true,
                primaryEmail: true,
              },
            },
          },
          orderBy: { matchScore: "desc" },
        },
        bookingRequests: {
          include: {
            resort: {
              select: { id: true, name: true },
            },
          },
        },
        agentExecutions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    // Decrypt PII
    const decryptedInquiry = {
      ...inquiry,
      contactName: decryptPII(inquiry.contactName),
      contactEmail: decryptPII(inquiry.contactEmail),
      contactPhone: inquiry.contactPhone
        ? decryptPII(inquiry.contactPhone)
        : null,
    };

    return NextResponse.json({ inquiry: decryptedInquiry });
  } catch (error) {
    console.error("Error fetching inquiry:", error);
    return NextResponse.json(
      { error: "Failed to fetch inquiry" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow status updates and selecting search results
    const allowedUpdates: Record<string, unknown> = {};

    if (body.status) {
      allowedUpdates.status = body.status;
    }

    if (body.selectedResorts && Array.isArray(body.selectedResorts)) {
      // Update selected search results
      await prisma.searchResult.updateMany({
        where: { inquiryId: id },
        data: { isSelected: false },
      });

      await prisma.searchResult.updateMany({
        where: {
          inquiryId: id,
          resortId: { in: body.selectedResorts },
        },
        data: { isSelected: true },
      });
    }

    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: allowedUpdates,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "INQUIRY_UPDATED",
        entityType: "Inquiry",
        entityId: id,
        newValues: body,
      },
    });

    return NextResponse.json({ inquiry });
  } catch (error) {
    console.error("Error updating inquiry:", error);
    return NextResponse.json(
      { error: "Failed to update inquiry" },
      { status: 500 }
    );
  }
}
