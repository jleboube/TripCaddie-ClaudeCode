import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { FileText, MapPin, TrendingUp, Clock } from "lucide-react";

async function getStats() {
  const [
    totalInquiries,
    pendingInquiries,
    completedInquiries,
    totalResorts,
    activeResorts,
    recentInquiries,
    recentExecutions,
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
    prisma.inquiry.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        inquiryNumber: true,
        status: true,
        createdAt: true,
        numberOfGolfers: true,
      },
    }),
    prisma.agentExecution.findMany({
      take: 5,
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
    }),
  ]);

  const conversionRate =
    totalInquiries > 0
      ? Math.round((completedInquiries / totalInquiries) * 100)
      : 0;

  return {
    totalInquiries,
    pendingInquiries,
    completedInquiries,
    totalResorts,
    activeResorts,
    conversionRate,
    recentInquiries,
    recentExecutions,
  };
}

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
    case "BOOKING_REQUEST_SENT":
      return "success";
    case "FAILED":
      return "destructive";
    case "PENDING":
    case "SEARCH_IN_PROGRESS":
    case "BOOKING_IN_PROGRESS":
      return "warning";
    default:
      return "secondary";
  }
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard - TripCaddie Admin",
};

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your golf trip booking system
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Inquiries
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInquiries}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingInquiries} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Resorts
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeResorts}</div>
            <p className="text-xs text-muted-foreground">
              of {stats.totalResorts} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedInquiries} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingInquiries}</div>
            <p className="text-xs text-muted-foreground">awaiting action</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Inquiries</CardTitle>
            <CardDescription>Latest quote requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentInquiries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No inquiries yet</p>
              ) : (
                stats.recentInquiries.map((inquiry) => (
                  <div
                    key={inquiry.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {inquiry.inquiryNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inquiry.numberOfGolfers} golfers -{" "}
                        {formatDate(inquiry.createdAt)}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(inquiry.status)}>
                      {inquiry.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Activity</CardTitle>
            <CardDescription>Recent agent executions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No agent activity yet
                </p>
              ) : (
                stats.recentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {execution.agentType} Agent
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {execution.inquiry.inquiryNumber}
                        {execution.durationMs &&
                          ` - ${execution.durationMs}ms`}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(execution.status)}>
                      {execution.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
