import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resortSchema } from "@/lib/validation";
import { z } from "zod";

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

    const resort = await prisma.resort.findUnique({
      where: { id },
      include: {
        availabilityWindows: {
          orderBy: { startDate: "asc" },
        },
        blackoutDates: {
          orderBy: { date: "asc" },
        },
        pricingRules: {
          orderBy: { priority: "desc" },
        },
        _count: {
          select: {
            searchResults: true,
            bookingRequests: true,
          },
        },
      },
    });

    if (!resort) {
      return NextResponse.json({ error: "Resort not found" }, { status: 404 });
    }

    return NextResponse.json({ resort });
  } catch (error) {
    console.error("Error fetching resort:", error);
    return NextResponse.json(
      { error: "Failed to fetch resort" },
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

    // Partial validation
    const partialSchema = resortSchema.partial();
    const validatedData = partialSchema.parse(body);

    // Check for duplicate slug if updating
    if (validatedData.slug) {
      const existing = await prisma.resort.findFirst({
        where: {
          slug: validatedData.slug,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A resort with this slug already exists" },
          { status: 400 }
        );
      }
    }

    const oldResort = await prisma.resort.findUnique({ where: { id } });

    const resort = await prisma.resort.update({
      where: { id },
      data: validatedData,
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESORT_UPDATED",
        entityType: "Resort",
        entityId: id,
        oldValues: oldResort as object,
        newValues: validatedData as object,
      },
    });

    return NextResponse.json({ resort });
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

    console.error("Error updating resort:", error);
    return NextResponse.json(
      { error: "Failed to update resort" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Soft delete by setting isActive to false
    const resort = await prisma.resort.update({
      where: { id },
      data: { isActive: false },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "RESORT_DEACTIVATED",
        entityType: "Resort",
        entityId: id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Resort deactivated successfully",
      resort,
    });
  } catch (error) {
    console.error("Error deactivating resort:", error);
    return NextResponse.json(
      { error: "Failed to deactivate resort" },
      { status: 500 }
    );
  }
}
