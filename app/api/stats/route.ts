import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { DashboardStats } from "@/types";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      totalInquiries,
      pendingInquiries,
      completedInquiries,
      totalResorts,
      activeResorts,
    ] = await Promise.all([
      prisma.inquiry.count(),
      prisma.inquiry.count({
        where: {
          status: {
            in: [
              "PENDING",
              "REQUEST_ACCEPTED",
              "SEARCH_IN_PROGRESS",
              "SEARCH_COMPLETED",
              "BOOKING_IN_PROGRESS",
            ],
          },
        },
      }),
      prisma.inquiry.count({
        where: {
          status: { in: ["BOOKING_REQUEST_SENT", "COMPLETED"] },
        },
      }),
      prisma.resort.count(),
      prisma.resort.count({ where: { isActive: true } }),
    ]);

    const conversionRate =
      totalInquiries > 0
        ? Math.round((completedInquiries / totalInquiries) * 100)
        : 0;

    const stats: DashboardStats = {
      totalInquiries,
      pendingInquiries,
      completedInquiries,
      totalResorts,
      activeResorts,
      conversionRate,
    };

    // Get recent activity
    const recentInquiries = await prisma.inquiry.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inquiryNumber: true,
        status: true,
        createdAt: true,
        numberOfGolfers: true,
      },
    });

    const recentExecutions = await prisma.agentExecution.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        agentType: true,
        status: true,
        durationMs: true,
        createdAt: true,
        inquiry: {
          select: { inquiryNumber: true },
        },
      },
    });

    return NextResponse.json({
      stats,
      recentInquiries,
      recentExecutions,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
