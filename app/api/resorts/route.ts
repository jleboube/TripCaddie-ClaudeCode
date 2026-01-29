import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resortSchema } from "@/lib/validation";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where = activeOnly ? { isActive: true } : {};

    const [resorts, total] = await Promise.all([
      prisma.resort.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              searchResults: true,
              bookingRequests: true,
            },
          },
        },
      }),
      prisma.resort.count({ where }),
    ]);

    return NextResponse.json({
      resorts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching resorts:", error);
    return NextResponse.json(
      { error: "Failed to fetch resorts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = resortSchema.parse(body);

    // Check for duplicate slug
    const existing = await prisma.resort.findUnique({
      where: { slug: validatedData.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A resort with this slug already exists" },
        { status: 400 }
      );
    }

    const resort = await prisma.resort.create({
      data: {
        ...validatedData,
        secondaryEmails: validatedData.secondaryEmails || [],
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESORT_CREATED",
        entityType: "Resort",
        entityId: resort.id,
        newValues: validatedData as object,
      },
    });

    return NextResponse.json({ resort }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("Error creating resort:", error);
    return NextResponse.json(
      { error: "Failed to create resort" },
      { status: 500 }
    );
  }
}
