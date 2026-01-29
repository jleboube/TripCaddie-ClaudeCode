import Link from "next/link";
import { prisma } from "@/lib/db";
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
import { Plus, Eye, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resorts - TripCaddie Admin",
};

async function getResorts() {
  return prisma.resort.findMany({
    orderBy: { name: "asc" },
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

export default async function ResortsPage() {
  const resorts = await getResorts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resorts</h1>
          <p className="text-muted-foreground">
            Manage golf resorts and their availability
          </p>
        </div>
        <Link href="/resorts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Resort
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Resorts</CardTitle>
          <CardDescription>
            {resorts.length} resorts configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resorts.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No resorts yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first resort to start receiving bookings
              </p>
              <Link href="/resorts/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Resort
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resort</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inquiries</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resorts.map((resort) => (
                  <TableRow key={resort.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{resort.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {resort.primaryEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {resort.city}, {resort.state}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{resort.maxGolfers} golfers max</p>
                        <p className="text-muted-foreground">
                          {resort.maxRooms} rooms
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={resort.isActive ? "success" : "secondary"}>
                        {resort.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {resort._count.searchResults} matches
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/resorts/${resort.id}`}>
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
