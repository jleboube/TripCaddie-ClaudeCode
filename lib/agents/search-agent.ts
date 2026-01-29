import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { AgentJobData, AgentResult } from "@/types";
import { Decimal } from "@prisma/client/runtime/library";

interface ResortMatch {
  resortId: string;
  matchScore: number;
  availabilityMatch: boolean;
  capacityMatch: boolean;
  priceMatch: boolean | null;
  // Price ranges per Original Prompt requirements
  estimatedTotal: number | null;
  estimatedMin: number | null;
  estimatedMax: number | null;
  perPersonMin: number | null;
  perPersonMax: number | null;
  priceBreakdown: Record<string, number> | null;
  pricingAssumptions: string[];
  availableRooms: number | null;
  availableTeeTimes: number | null;
  weatherOverview: { avgHigh: number; avgLow: number; conditions: string } | null;
  sampleItinerary: Array<{ day: number; activities: string[] }> | null;
  notes: string[];
}

export async function processSearchAgent(
  job: Job<AgentJobData>
): Promise<AgentResult> {
  const { inquiryId } = job.data;
  const startTime = Date.now();

  // Update execution status
  await prisma.agentExecution.updateMany({
    where: { jobId: job.id },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  // Update inquiry status
  await prisma.inquiry.update({
    where: { id: inquiryId },
    data: { status: "SEARCH_IN_PROGRESS" },
  });

  try {
    // Fetch inquiry with normalized data
    const inquiry = await prisma.inquiry.findUnique({
      where: { id: inquiryId },
    });

    if (!inquiry) {
      throw new Error(`Inquiry not found: ${inquiryId}`);
    }

    // Fetch all active resorts
    const resorts = await prisma.resort.findMany({
      where: { isActive: true },
      include: {
        availabilityWindows: true,
        blackoutDates: true,
        pricingRules: {
          where: { isActive: true },
          orderBy: { priority: "desc" },
        },
      },
    });

    const matches: ResortMatch[] = [];

    for (const resort of resorts) {
      const match = evaluateResortMatch(inquiry, resort);
      if (match.matchScore > 0) {
        matches.push(match);
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Clear existing search results for this inquiry
    await prisma.searchResult.deleteMany({
      where: { inquiryId },
    });

    // Create new search results
    if (matches.length > 0) {
      await prisma.searchResult.createMany({
        data: matches.map((match) => ({
          inquiryId,
          resortId: match.resortId,
          matchScore: new Decimal(match.matchScore),
          availabilityMatch: match.availabilityMatch,
          capacityMatch: match.capacityMatch,
          priceMatch: match.priceMatch,
          estimatedTotal: match.estimatedTotal
            ? new Decimal(match.estimatedTotal)
            : null,
          estimatedMin: match.estimatedMin
            ? new Decimal(match.estimatedMin)
            : null,
          estimatedMax: match.estimatedMax
            ? new Decimal(match.estimatedMax)
            : null,
          perPersonMin: match.perPersonMin
            ? new Decimal(match.perPersonMin)
            : null,
          perPersonMax: match.perPersonMax
            ? new Decimal(match.perPersonMax)
            : null,
          priceBreakdown: match.priceBreakdown
            ? (match.priceBreakdown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          pricingAssumptions: match.pricingAssumptions,
          availableRooms: match.availableRooms,
          availableTeeTimes: match.availableTeeTimes,
          weatherOverview: match.weatherOverview
            ? (match.weatherOverview as Prisma.InputJsonValue)
            : Prisma.DbNull,
          sampleItinerary: match.sampleItinerary
            ? (match.sampleItinerary as Prisma.InputJsonValue)
            : Prisma.DbNull,
          notes: match.notes.join("\n"),
        })),
      });
    }

    // Update inquiry status
    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: "SEARCH_COMPLETED" },
    });

    // Mark execution complete
    const durationMs = Date.now() - startTime;
    await prisma.agentExecution.updateMany({
      where: { jobId: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        durationMs,
        output: {
          matchCount: matches.length,
          topMatches: matches.slice(0, 5).map((m) => ({
            ...m,
            priceBreakdown: m.priceBreakdown ?? undefined,
          })),
        } as Prisma.InputJsonValue,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "SEARCH_AGENT_COMPLETED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: {
          resortCount: resorts.length,
          matchCount: matches.length,
          durationMs,
        },
      },
    });

    return {
      success: true,
      data: {
        matchCount: matches.length,
        topMatches: matches.slice(0, 10),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    await prisma.agentExecution.updateMany({
      where: { jobId: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        durationMs,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      },
    });

    await prisma.inquiry.update({
      where: { id: inquiryId },
      data: { status: "FAILED" },
    });

    await prisma.auditLog.create({
      data: {
        action: "SEARCH_AGENT_FAILED",
        entityType: "Inquiry",
        entityId: inquiryId,
        metadata: { error: errorMessage, durationMs },
      },
    });

    throw error;
  }
}

// Monthly weather data for common golf destinations
const DESTINATION_WEATHER: Record<string, Record<string, { avgHigh: number; avgLow: number; conditions: string }>> = {
  NC: { // Pinehurst
    jan: { avgHigh: 52, avgLow: 32, conditions: "Cool and dry" },
    feb: { avgHigh: 56, avgLow: 34, conditions: "Cool with occasional rain" },
    mar: { avgHigh: 64, avgLow: 40, conditions: "Mild and pleasant" },
    apr: { avgHigh: 73, avgLow: 48, conditions: "Warm and ideal for golf" },
    may: { avgHigh: 80, avgLow: 57, conditions: "Warm with low humidity" },
    jun: { avgHigh: 87, avgLow: 65, conditions: "Hot with afternoon storms possible" },
    jul: { avgHigh: 90, avgLow: 69, conditions: "Hot and humid" },
    aug: { avgHigh: 88, avgLow: 68, conditions: "Hot and humid" },
    sep: { avgHigh: 82, avgLow: 62, conditions: "Warm and pleasant" },
    oct: { avgHigh: 72, avgLow: 50, conditions: "Perfect golf weather" },
    nov: { avgHigh: 62, avgLow: 40, conditions: "Cool and crisp" },
    dec: { avgHigh: 53, avgLow: 33, conditions: "Cool with occasional frost" },
  },
  WI: { // Kohler
    jan: { avgHigh: 28, avgLow: 13, conditions: "Cold with snow" },
    feb: { avgHigh: 32, avgLow: 16, conditions: "Cold with snow" },
    mar: { avgHigh: 43, avgLow: 26, conditions: "Cool, thawing" },
    apr: { avgHigh: 55, avgLow: 36, conditions: "Cool and variable" },
    may: { avgHigh: 66, avgLow: 46, conditions: "Pleasant with spring showers" },
    jun: { avgHigh: 76, avgLow: 56, conditions: "Warm and ideal" },
    jul: { avgHigh: 81, avgLow: 62, conditions: "Warm and sunny" },
    aug: { avgHigh: 79, avgLow: 61, conditions: "Warm and pleasant" },
    sep: { avgHigh: 71, avgLow: 52, conditions: "Comfortable and clear" },
    oct: { avgHigh: 58, avgLow: 41, conditions: "Cool and colorful" },
    nov: { avgHigh: 44, avgLow: 30, conditions: "Cold, season ending" },
    dec: { avgHigh: 31, avgLow: 17, conditions: "Cold with snow" },
  },
  MO: { // Big Cedar
    jan: { avgHigh: 45, avgLow: 25, conditions: "Cool and dry" },
    feb: { avgHigh: 51, avgLow: 29, conditions: "Cool with occasional rain" },
    mar: { avgHigh: 60, avgLow: 37, conditions: "Mild and pleasant" },
    apr: { avgHigh: 70, avgLow: 46, conditions: "Warm with spring showers" },
    may: { avgHigh: 77, avgLow: 55, conditions: "Warm and pleasant" },
    jun: { avgHigh: 85, avgLow: 64, conditions: "Hot with afternoon storms" },
    jul: { avgHigh: 90, avgLow: 68, conditions: "Hot and humid" },
    aug: { avgHigh: 89, avgLow: 67, conditions: "Hot and humid" },
    sep: { avgHigh: 81, avgLow: 58, conditions: "Warm and pleasant" },
    oct: { avgHigh: 70, avgLow: 47, conditions: "Perfect fall golf" },
    nov: { avgHigh: 57, avgLow: 36, conditions: "Cool and crisp" },
    dec: { avgHigh: 46, avgLow: 27, conditions: "Cool with occasional frost" },
  },
};

function getWeatherForMonth(state: string, arrivalDate: Date): { avgHigh: number; avgLow: number; conditions: string } | null {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = months[arrivalDate.getMonth()];
  const stateWeather = DESTINATION_WEATHER[state];
  return stateWeather?.[month] || null;
}

function generateSampleItinerary(
  numberOfNights: number,
  roundsPerGolfer: number,
  resortName: string
): Array<{ day: number; activities: string[] }> {
  const itinerary: Array<{ day: number; activities: string[] }> = [];
  let roundsScheduled = 0;

  for (let day = 1; day <= numberOfNights + 1; day++) {
    const activities: string[] = [];

    if (day === 1) {
      activities.push("Arrival and check-in");
      activities.push("Range session and course orientation");
      if (roundsScheduled < roundsPerGolfer) {
        activities.push(`Afternoon round at ${resortName}`);
        roundsScheduled++;
      }
      activities.push("Welcome dinner");
    } else if (day === numberOfNights + 1) {
      activities.push("Breakfast");
      activities.push("Check-out and departure");
    } else {
      activities.push("Breakfast at resort");
      if (roundsScheduled < roundsPerGolfer) {
        activities.push(`Morning round (18 holes)`);
        roundsScheduled++;
      }
      if (roundsScheduled < roundsPerGolfer && day < numberOfNights) {
        activities.push("Lunch at clubhouse");
        activities.push(`Afternoon round (18 holes)`);
        roundsScheduled++;
      } else {
        activities.push("Leisure time / spa / practice");
      }
      activities.push("Group dinner");
    }

    itinerary.push({ day, activities });
  }

  return itinerary;
}

function evaluateResortMatch(
  inquiry: {
    arrivalDate: Date;
    departureDate: Date;
    numberOfGolfers: number;
    numberOfRooms: number;
    numberOfNights: number;
    roundsPerGolfer: number;
    roomType: string | null;
    budgetMin: Decimal | null;
    budgetMax: Decimal | null;
    preferredResorts: string[];
  },
  resort: {
    id: string;
    name: string;
    state: string;
    maxGolfers: number;
    maxRooms: number;
    minimumNights: number;
    minimumGolfers: number;
    advanceBookingDays: number;
    basePricePerGolfer: Decimal | null;
    basePricePerRoom: Decimal | null;
    weatherInfo: unknown;
    availabilityWindows: Array<{
      startDate: Date;
      endDate: Date;
      availableRooms: number | null;
      availableTeeTimes: number | null;
    }>;
    blackoutDates: Array<{ date: Date }>;
    pricingRules: Array<{
      startDate: Date | null;
      endDate: Date | null;
      pricePerGolfer: Decimal | null;
      pricePerRoom: Decimal | null;
      percentageAdjust: Decimal | null;
      minimumNights: number | null;
      minimumGolfers: number | null;
    }>;
  }
): ResortMatch {
  const notes: string[] = [];
  let score = 100;
  const pricingAssumptions: string[] = [];

  // Check capacity
  const capacityMatch =
    inquiry.numberOfGolfers <= resort.maxGolfers &&
    inquiry.numberOfRooms <= resort.maxRooms;

  if (!capacityMatch) {
    score -= 50;
    notes.push("Exceeds resort capacity");
  }

  // Check minimum requirements
  if (inquiry.numberOfNights < resort.minimumNights) {
    score -= 20;
    notes.push(`Minimum ${resort.minimumNights} nights required`);
  }

  if (inquiry.numberOfGolfers < resort.minimumGolfers) {
    score -= 20;
    notes.push(`Minimum ${resort.minimumGolfers} golfers required`);
  }

  // Check advance booking
  const daysUntilArrival = Math.ceil(
    (inquiry.arrivalDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilArrival < resort.advanceBookingDays) {
    score -= 30;
    notes.push(`Requires ${resort.advanceBookingDays} days advance booking`);
  }

  // Check availability windows
  let availabilityMatch = false;
  let availableRooms: number | null = null;
  let availableTeeTimes: number | null = null;

  for (const window of resort.availabilityWindows) {
    if (
      inquiry.arrivalDate >= window.startDate &&
      inquiry.departureDate <= window.endDate
    ) {
      availabilityMatch = true;
      availableRooms = window.availableRooms;
      availableTeeTimes = window.availableTeeTimes;
      break;
    }
  }

  if (!availabilityMatch && resort.availabilityWindows.length > 0) {
    score -= 30;
    notes.push("Outside availability windows");
  }

  // Check blackout dates
  const tripDates: Date[] = [];
  let currentDate = new Date(inquiry.arrivalDate);
  while (currentDate < inquiry.departureDate) {
    tripDates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const blackoutDatesSet = new Set(
    resort.blackoutDates.map((bd) => bd.date.toISOString().split("T")[0])
  );

  const hasBlackout = tripDates.some((date) =>
    blackoutDatesSet.has(date.toISOString().split("T")[0])
  );

  if (hasBlackout) {
    score -= 40;
    notes.push("Includes blackout dates");
  }

  // Calculate estimated price with RANGES per Original Prompt
  let estimatedTotal: number | null = null;
  let estimatedMin: number | null = null;
  let estimatedMax: number | null = null;
  let perPersonMin: number | null = null;
  let perPersonMax: number | null = null;
  let priceBreakdown: Record<string, number> | null = null;
  let priceMatch: boolean | null = null;

  const basePricePerGolfer = resort.basePricePerGolfer
    ? Number(resort.basePricePerGolfer)
    : 0;
  const basePricePerRoom = resort.basePricePerRoom
    ? Number(resort.basePricePerRoom)
    : 0;

  // Determine room type assumption
  const roomType = inquiry.roomType || "double";
  const roomTypeLabel = {
    single: "Single occupancy",
    double: "Double occupancy",
    triple: "Triple occupancy",
    quad: "Quad occupancy",
  }[roomType] || "Double occupancy";

  if (basePricePerGolfer > 0 || basePricePerRoom > 0) {
    const golfCost =
      basePricePerGolfer *
      inquiry.numberOfGolfers *
      inquiry.roundsPerGolfer;
    const roomCost =
      basePricePerRoom * inquiry.numberOfRooms * inquiry.numberOfNights;

    estimatedTotal = golfCost + roomCost;

    // Generate price ranges (±15% variance per Original Prompt requirement)
    const varianceLow = 0.85;  // -15%
    const varianceHigh = 1.15; // +15%

    priceBreakdown = {
      golf: golfCost,
      rooms: roomCost,
      resortFees: estimatedTotal * 0.05, // Estimated 5% resort fees
      total: estimatedTotal,
    };

    // Add pricing assumptions per Original Prompt
    pricingAssumptions.push(roomTypeLabel);
    pricingAssumptions.push("Standard peak-season rates");
    pricingAssumptions.push("Estimated resort fees included");
    pricingAssumptions.push("Green fees based on standard rates");
    pricingAssumptions.push("Cart fees included");

    // Apply pricing rules
    for (const rule of resort.pricingRules) {
      const ruleApplies =
        (!rule.startDate || inquiry.arrivalDate >= rule.startDate) &&
        (!rule.endDate || inquiry.departureDate <= rule.endDate) &&
        (!rule.minimumNights || inquiry.numberOfNights >= rule.minimumNights) &&
        (!rule.minimumGolfers || inquiry.numberOfGolfers >= rule.minimumGolfers);

      if (ruleApplies && rule.percentageAdjust) {
        const adjustment = Number(rule.percentageAdjust) / 100;
        estimatedTotal = estimatedTotal * (1 + adjustment);
        priceBreakdown.adjustment = adjustment * 100;
        priceBreakdown.total = estimatedTotal;
        break; // Apply first matching rule only
      }
    }

    // Calculate final ranges
    estimatedMin = Math.round(estimatedTotal * varianceLow);
    estimatedMax = Math.round(estimatedTotal * varianceHigh);
    perPersonMin = Math.round(estimatedMin / inquiry.numberOfGolfers);
    perPersonMax = Math.round(estimatedMax / inquiry.numberOfGolfers);

    // Check against budget
    if (inquiry.budgetMin || inquiry.budgetMax) {
      const min = inquiry.budgetMin ? Number(inquiry.budgetMin) : 0;
      const max = inquiry.budgetMax ? Number(inquiry.budgetMax) : Infinity;
      // Use the range midpoint for budget matching
      priceMatch = estimatedTotal >= min && estimatedTotal <= max;

      if (!priceMatch) {
        score -= 15;
        notes.push("Outside budget range");
      }
    }
  }

  // Bonus for preferred resorts
  if (inquiry.preferredResorts.includes(resort.id)) {
    score += 20;
    notes.push("Preferred resort");
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Get weather for travel dates
  const weatherOverview = getWeatherForMonth(resort.state, inquiry.arrivalDate);

  // Generate sample itinerary
  const sampleItinerary = generateSampleItinerary(
    inquiry.numberOfNights,
    inquiry.roundsPerGolfer,
    resort.name
  );

  return {
    resortId: resort.id,
    matchScore: score,
    availabilityMatch,
    capacityMatch,
    priceMatch,
    estimatedTotal,
    estimatedMin,
    estimatedMax,
    perPersonMin,
    perPersonMax,
    priceBreakdown,
    pricingAssumptions,
    availableRooms,
    availableTeeTimes,
    weatherOverview,
    sampleItinerary,
    notes,
  };
}
