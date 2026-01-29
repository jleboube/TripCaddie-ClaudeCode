import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getQueueStats } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString(),
    queues: null as Record<string, unknown> | null,
  };

  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  try {
    // Check Redis via queue stats (this will fail if Redis is down)
    const queueStats = await getQueueStats();
    if (queueStats) {
      checks.redis = true;
      checks.queues = queueStats;
    }
  } catch (error) {
    console.error("Redis health check failed:", error);
  }

  const healthy = checks.database && checks.redis;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
