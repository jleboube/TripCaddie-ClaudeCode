import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptPII } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where = status ? { status: status as never } : {};

    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          searchResults: {
            select: { id: true, resortId: true, matchScore: true },
          },
          agentExecutions: {
            select: { id: true, agentType: true, status: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.inquiry.count({ where }),
    ]);

    // Decrypt PII for display
    const decryptedInquiries = inquiries.map((inquiry) => ({
      ...inquiry,
      contactName: decryptPII(inquiry.contactName),
      contactEmail: decryptPII(inquiry.contactEmail),
      contactPhone: inquiry.contactPhone
        ? decryptPII(inquiry.contactPhone)
        : null,
    }));

    return NextResponse.json({
      inquiries: decryptedInquiries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching inquiries:", error);
    return NextResponse.json(
      { error: "Failed to fetch inquiries" },
      { status: 500 }
    );
  }
}
