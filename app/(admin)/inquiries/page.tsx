import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { decryptPII as decrypt } from "@/lib/encryption";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Users, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inquiries - TripCaddie Admin",
};

async function getInquiries() {
  return prisma.inquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      _count: {
        select: {
          searchResults: true,
          bookingRequests: true,
        },
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
    case "CANCELLED":
      return "destructive";
    case "PENDING":
      return "secondary";
    default:
      return "warning";
  }
}

export default async function InquiriesPage() {
  const inquiries = await getInquiries();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inquiries</h1>
          <p className="text-muted-foreground">
            Manage and track golf trip quote requests
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Inquiries</CardTitle>
          <CardDescription>
            {inquiries.length} total inquiries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inquiries.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No inquiries yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Inquiries will appear here when customers submit quote requests
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inquiry #</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Trip Details</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell className="font-mono font-medium">
                      {inquiry.inquiryNumber}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {decrypt(inquiry.contactName)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {decrypt(inquiry.contactEmail)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {inquiry.numberOfGolfers}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {inquiry.numberOfNights} nights
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(inquiry.status)}>
                        {inquiry.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {inquiry._count.searchResults} matches
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(inquiry.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/inquiries/${inquiry.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
