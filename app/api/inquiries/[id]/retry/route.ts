import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  triggerRequestAgent,
  triggerSearchAgent,
  triggerBookingAgent,
} from "@/lib/agents";
import { AgentType } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: inquiryId } = await params;
    const body = await request.json();
    const { agentType } = body;

    if (!agentType || !["REQUEST", "SEARCH", "BOOKING"].includes(agentType)) {
      return NextResponse.json(
        { error: "Invalid agent type" },
        { status: 400 }
      );
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
      include: {
        searchResults: {
          where: { isSelected: true },
          select: { resortId: true },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }

    let result;

    switch (agentType as AgentType) {
      case "REQUEST":
        result = await triggerRequestAgent(inquiryId);
        break;
      case "SEARCH":
        result = await triggerSearchAgent(inquiryId);
        break;
      case "BOOKING":
        // Filter out null resortIds (web search results without database link)
        const resortIds = inquiry.searchResults
          .map((r) => r.resortId)
          .filter((id): id is string => id !== null);
        if (resortIds.length === 0) {
          return NextResponse.json(
            { error: "No database resorts selected for booking. Web search results cannot be booked directly." },
            { status: 400 }
          );
        }
        result = await triggerBookingAgent(inquiryId, resortIds);
        break;
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "AGENT_RETRY_TRIGGERED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: { agentType, ...result },
      },
    });

    return NextResponse.json({
      success: true,
      message: `${agentType} agent triggered successfully`,
      ...result,
    });
  } catch (error) {
    console.error("Error triggering agent retry:", error);
    return NextResponse.json(
      { error: "Failed to trigger agent" },
      { status: 500 }
    );
  }
}
