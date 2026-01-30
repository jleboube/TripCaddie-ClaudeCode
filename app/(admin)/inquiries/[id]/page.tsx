import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { decryptPII } from "@/lib/encryption";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { InquiryActions } from "@/components/admin/inquiry-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inquiry Details - TripCaddie Admin",
};

async function getInquiry(id: string) {
  return prisma.inquiry.findUnique({
    where: { id },
    include: {
      searchResults: {
        include: {
          resort: true,
        },
        orderBy: { matchScore: "desc" },
      },
      bookingRequests: {
        include: {
          resort: true,
        },
      },
      agentExecutions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

function getStatusVariant(status: string) {
  switch (status) {
    case "COMPLETED":
    case "BOOKING_REQUEST_SENT":
      return "success";
    case "FAILED":
      return "destructive";
    default:
      return "secondary";
  }
}

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inquiry = await getInquiry(id);

  if (!inquiry) {
    notFound();
  }

  const contactName = decryptPII(inquiry.contactName);
  const contactEmail = decryptPII(inquiry.contactEmail);
  const contactPhone = inquiry.contactPhone
    ? decryptPII(inquiry.contactPhone)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {inquiry.inquiryNumber}
          </h1>
          <p className="text-muted-foreground">
            Created {formatDate(inquiry.createdAt)}
          </p>
        </div>
        <Badge variant={getStatusVariant(inquiry.status)} className="text-sm">
          {inquiry.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{contactName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{contactEmail}</p>
            </div>
            {contactPhone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{contactPhone}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trip Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Arrival</p>
                <p className="font-medium">{formatDate(inquiry.arrivalDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Departure</p>
                <p className="font-medium">
                  {formatDate(inquiry.departureDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nights</p>
                <p className="font-medium">{inquiry.numberOfNights}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Golfers</p>
                <p className="font-medium">{inquiry.numberOfGolfers}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rounds/Golfer</p>
                <p className="font-medium">{inquiry.roundsPerGolfer}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rooms</p>
                <p className="font-medium">
                  {inquiry.numberOfRooms}
                  {inquiry.roomType && ` (${inquiry.roomType})`}
                </p>
              </div>
            </div>
            {(inquiry.budgetMin || inquiry.budgetMax) && (
              <div>
                <p className="text-sm text-muted-foreground">Budget</p>
                <p className="font-medium">
                  {inquiry.budgetMin &&
                    formatCurrency(Number(inquiry.budgetMin))}
                  {inquiry.budgetMin && inquiry.budgetMax && " - "}
                  {inquiry.budgetMax &&
                    formatCurrency(Number(inquiry.budgetMax))}
                </p>
              </div>
            )}
            {inquiry.specialRequests && (
              <div>
                <p className="text-sm text-muted-foreground">Special Requests</p>
                <p className="text-sm">{inquiry.specialRequests}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">
            Search Results ({inquiry.searchResults.length})
          </TabsTrigger>
          <TabsTrigger value="bookings">
            Booking Requests ({inquiry.bookingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="agents">
            Agent History ({inquiry.agentExecutions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Matched Resorts</CardTitle>
              <CardDescription>
                Resorts from database and web search results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inquiry.searchResults.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No search results yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resort</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Match Score</TableHead>
                      <TableHead>Est. Range</TableHead>
                      <TableHead>Selected</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiry.searchResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">
                          {result.resort ? (
                            result.resort.name
                          ) : result.webResortUrl ? (
                            <a
                              href={result.webResortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {result.webResortName || "Unknown Resort"}
                            </a>
                          ) : (
                            result.webResortName || "Unknown Resort"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              result.source === "database"
                                ? "default"
                                : "outline"
                            }
                          >
                            {result.source === "database" ? "DB" : "Web"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {result.resort
                            ? `${result.resort.city}, ${result.resort.state}`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              Number(result.matchScore) >= 70
                                ? "success"
                                : "secondary"
                            }
                          >
                            {Number(result.matchScore).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {result.estimatedMin && result.estimatedMax
                            ? `${formatCurrency(Number(result.estimatedMin))} - ${formatCurrency(Number(result.estimatedMax))}`
                            : result.estimatedTotal
                              ? formatCurrency(Number(result.estimatedTotal))
                              : "-"}
                        </TableCell>
                        <TableCell>
                          {result.isSelected ? (
                            <Badge variant="success">Selected</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Booking Requests</CardTitle>
              <CardDescription>Emails sent to resorts</CardDescription>
            </CardHeader>
            <CardContent>
              {inquiry.bookingRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No booking requests sent yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resort</TableHead>
                      <TableHead>Sent To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiry.bookingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.resort.name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.sentToEmails.join(", ")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              request.deliveryStatus === "SENT" ||
                              request.deliveryStatus === "DELIVERED"
                                ? "success"
                                : "destructive"
                            }
                          >
                            {request.deliveryStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.sentAt
                            ? formatDate(request.sentAt)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Agent Execution History</CardTitle>
              <CardDescription>
                Processing timeline for this inquiry
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inquiry.agentExecutions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No agent executions yet
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Attempt</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inquiry.agentExecutions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-medium">
                          {execution.agentType} Agent
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(execution.status)}>
                            {execution.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {execution.durationMs
                            ? `${execution.durationMs}ms`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {execution.attemptNumber}/{execution.maxAttempts}
                        </TableCell>
                        <TableCell className="text-sm">
                          {execution.startedAt
                            ? formatDate(execution.startedAt)
                            : formatDate(execution.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Manually trigger agents or update status</CardDescription>
        </CardHeader>
        <CardContent>
          <InquiryActions
            inquiryId={inquiry.id}
            currentStatus={inquiry.status}
            hasSearchResults={inquiry.searchResults.length > 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
