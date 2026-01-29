import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle,
  Phone,
  Calendar,
  Users,
  MapPin,
  CloudSun,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { decryptPII } from "@/lib/encryption";
import { DESTINATIONS } from "@/lib/validation";
import { format } from "date-fns";

export const metadata = {
  title: "Quote Request Confirmed - TripCaddie",
};

// TripCaddie disclaimer per Original Prompt (verbatim)
const TRIPCADDIE_DISCLAIMER =
  "These are only estimates provided by TripCaddie and are subject availability on the dates requested and the final pricing from the resort. If you are interested in moving forward, please call us at 708.320.8210. Thank you for allowing TripCaddie to serve you!";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const { inquiryId } = await params;

  // Fetch inquiry with search results
  const inquiry = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      searchResults: {
        include: {
          resort: true,
        },
        orderBy: { matchScore: "desc" },
        take: 3, // Show top 3 matches
      },
    },
  });

  if (!inquiry) {
    notFound();
  }

  // Decrypt contact info for display
  const contactName = decryptPII(inquiry.contactName);
  const contactEmail = decryptPII(inquiry.contactEmail);

  // Get destination label
  const destinationInfo = DESTINATIONS.find((d) => d.value === inquiry.destination);
  const destinationLabel = destinationInfo
    ? `${destinationInfo.label}${destinationInfo.state ? `, ${destinationInfo.state}` : ""}`
    : inquiry.destination;

  // Format room type for display
  const roomTypeLabels: Record<string, string> = {
    single: "Single Occupancy",
    double: "Double Occupancy",
    triple: "Triple Occupancy",
    quad: "Quad Occupancy",
  };

  // Get the top search result for detailed display
  const topResult = inquiry.searchResults[0];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Quote Request Received!</CardTitle>
            <CardDescription>
              We&apos;re processing your request and will be in touch soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <p className="text-sm text-gray-500 mb-1">Reference Number</p>
              <p className="text-xl font-mono font-semibold">
                {inquiry.inquiryNumber}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Trip Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Trip Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Destination</p>
                  <p className="font-medium">{destinationLabel}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Travel Dates</p>
                  <p className="font-medium">
                    {format(inquiry.arrivalDate, "MMM d")} -{" "}
                    {format(inquiry.departureDate, "MMM d, yyyy")}
                  </p>
                  <p className="text-sm text-gray-500">
                    {inquiry.numberOfNights} nights
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Group Size</p>
                  <p className="font-medium">
                    {inquiry.numberOfGolfers} golfers, {inquiry.numberOfRooms} rooms
                  </p>
                  <p className="text-sm text-gray-500">
                    {roomTypeLabels[inquiry.roomType] || inquiry.roomType}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xl">⛳</span>
                <div>
                  <p className="text-sm text-gray-500">Golf</p>
                  <p className="font-medium">
                    {inquiry.roundsPerGolfer} rounds per golfer
                  </p>
                  <p className="text-sm text-gray-500">
                    {inquiry.numberOfGolfers * inquiry.roundsPerGolfer} total rounds
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weather Overview */}
        {topResult?.weatherOverview && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CloudSun className="h-5 w-5" />
                Weather Overview
              </CardTitle>
              <CardDescription>
                Typical conditions for {format(inquiry.arrivalDate, "MMMM")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-3xl font-bold">
                    {(topResult.weatherOverview as { avgHigh: number }).avgHigh}°F
                  </p>
                  <p className="text-sm text-gray-500">Average High</p>
                </div>
                <div>
                  <p className="text-3xl font-bold">
                    {(topResult.weatherOverview as { avgLow: number }).avgLow}°F
                  </p>
                  <p className="text-sm text-gray-500">Average Low</p>
                </div>
                <div className="flex-1">
                  <p className="text-gray-600">
                    {(topResult.weatherOverview as { conditions: string }).conditions}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estimated Pricing */}
        {topResult && (topResult.estimatedMin || topResult.estimatedMax) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Estimated Pricing
              </CardTitle>
              <CardDescription>
                Preliminary quote range based on your requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-sm text-gray-600 mb-1">Total Package Price</p>
                  <p className="text-2xl font-bold text-green-700">
                    ${Number(topResult.estimatedMin).toLocaleString()} - $
                    {Number(topResult.estimatedMax).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-gray-600 mb-1">Price Per Person</p>
                  <p className="text-2xl font-bold text-blue-700">
                    ${Number(topResult.perPersonMin).toLocaleString()} - $
                    {Number(topResult.perPersonMax).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Pricing Assumptions */}
              {topResult.pricingAssumptions && topResult.pricingAssumptions.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Pricing Assumptions:
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2 text-sm text-gray-600">
                    {topResult.pricingAssumptions.map((assumption, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sample Itinerary */}
        {topResult?.sampleItinerary && (
          <Card>
            <CardHeader>
              <CardTitle>Sample Itinerary</CardTitle>
              <CardDescription>
                A suggested schedule for your {inquiry.numberOfNights}-night golf trip
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(topResult.sampleItinerary as Array<{ day: number; activities: string[] }>).map(
                  (day) => (
                    <div key={day.day} className="flex gap-4">
                      <div className="flex-shrink-0 w-16">
                        <div className="rounded-full bg-green-100 text-green-700 font-semibold text-sm px-3 py-1 text-center">
                          Day {day.day}
                        </div>
                      </div>
                      <ul className="flex-1 space-y-1">
                        {day.activities.map((activity, i) => (
                          <li key={i} className="text-sm text-gray-600">
                            • {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
              <li>
                Our system is automatically matching you with the best resorts for
                your trip
              </li>
              <li>
                Resorts that fit your criteria will receive your booking request
              </li>
              <li>
                You&apos;ll receive detailed quotes directly from the resorts via
                email at <span className="font-medium">{contactEmail}</span>
              </li>
              <li>Choose the option that works best for your group</li>
            </ol>

            {/* Call to Action */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 mt-6">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-blue-900">
                    Ready to move forward?
                  </p>
                  <p className="text-blue-700 mt-1">
                    Call us at{" "}
                    <a
                      href="tel:708-320-8210"
                      className="font-bold hover:underline"
                    >
                      708.320.8210
                    </a>{" "}
                    to speak with a TripCaddie golf trip specialist.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer - Verbatim per Original Prompt */}
        <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-600 italic">
          {TRIPCADDIE_DISCLAIMER}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link href="/quote">
            <Button variant="outline" className="w-full">
              Submit Another Request
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" className="w-full">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
