import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { decryptPII } from "../encryption";
import { searchForGolfResorts, cleanup as cleanupBrowser } from "../services/web-search";
import { analyzeResortResults, generateItinerary, estimatePricing } from "../services/gemini";
import { getWeatherForLocation } from "../services/weather";
import { DESTINATIONS } from "../validation";
import type { AgentJobData, AgentResult } from "@/types";
import { Decimal } from "@prisma/client/runtime/library";

interface DatabaseResortMatch {
  resortId: string;
  resortName: string;
  matchScore: number;
  source: "database";
  availabilityMatch: boolean;
  capacityMatch: boolean;
  priceMatch: boolean | null;
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
  contactInfo?: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

interface WebResortMatch {
  resortId: string; // Generated ID for web results
  resortName: string;
  matchScore: number;
  source: "web";
  description: string;
  estimatedMin: number | null;
  estimatedMax: number | null;
  perPersonMin: number | null;
  perPersonMax: number | null;
  pricingAssumptions: string[];
  weatherOverview: { avgHigh: number; avgLow: number; conditions: string } | null;
  sampleItinerary: Array<{ day: number; activities: string[] }> | null;
  amenities: string[];
  highlights: string[];
  considerations: string[];
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
  };
}

type ResortMatch = DatabaseResortMatch | WebResortMatch;

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

    // Get destination info
    const destinationInfo = DESTINATIONS.find((d) => d.value === inquiry.destination);
    const destinationLabel = destinationInfo
      ? `${destinationInfo.label}, ${destinationInfo.state}`
      : inquiry.destination;

    console.log(`[Search Agent] Processing inquiry ${inquiry.inquiryNumber}`);
    console.log(`[Search Agent] Destination: ${destinationLabel}`);

    // ========================================
    // PHASE 1: Search Internal Database
    // ========================================
    console.log("[Search Agent] Phase 1: Searching internal database...");

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

    const dbMatches: DatabaseResortMatch[] = [];

    for (const resort of resorts) {
      const match = await evaluateDatabaseResort(inquiry, resort, destinationLabel);
      if (match.matchScore > 0) {
        dbMatches.push(match);
      }
    }

    // Sort database matches by score
    dbMatches.sort((a, b) => b.matchScore - a.matchScore);
    console.log(`[Search Agent] Found ${dbMatches.length} database matches`);

    // ========================================
    // PHASE 2: Search the Web
    // ========================================
    console.log("[Search Agent] Phase 2: Searching the web...");

    let webMatches: WebResortMatch[] = [];

    try {
      // Search the web for golf resorts
      const webResults = await searchForGolfResorts(destinationLabel);
      console.log(`[Search Agent] Found ${webResults.length} web results`);

      if (webResults.length > 0) {
        // Use Gemini to analyze web results
        console.log("[Search Agent] Analyzing web results with Gemini AI...");

        const analyzedResults = await analyzeResortResults(webResults, {
          destination: destinationLabel,
          numberOfGolfers: inquiry.numberOfGolfers,
          numberOfNights: inquiry.numberOfNights,
          roundsPerGolfer: inquiry.roundsPerGolfer,
          numberOfRooms: inquiry.numberOfRooms,
          budgetMin: inquiry.budgetMin ? Number(inquiry.budgetMin) : undefined,
          budgetMax: inquiry.budgetMax ? Number(inquiry.budgetMax) : undefined,
          specialRequests: inquiry.specialRequests || undefined,
        });

        // Get weather for the destination
        console.log("[Search Agent] Fetching weather data...");
        const weather = await getWeatherForLocation(destinationLabel, inquiry.arrivalDate);

        // Convert analyzed results to WebResortMatch format
        for (const result of analyzedResults) {
          // Generate itinerary for top results
          const itinerary = await generateItinerary(
            result.name,
            inquiry.numberOfNights,
            inquiry.roundsPerGolfer,
            inquiry.numberOfGolfers,
            destinationLabel
          );

          // Estimate pricing
          const pricing = await estimatePricing(
            result.name,
            destinationLabel,
            inquiry.numberOfGolfers,
            inquiry.numberOfNights,
            inquiry.roundsPerGolfer,
            inquiry.numberOfRooms
          );

          webMatches.push({
            resortId: `web-${Buffer.from(result.name).toString("base64").slice(0, 16)}`,
            resortName: result.name,
            matchScore: result.overallScore,
            source: "web",
            description: result.description,
            estimatedMin: pricing?.estimatedMin || null,
            estimatedMax: pricing?.estimatedMax || null,
            perPersonMin: pricing?.perPersonMin || null,
            perPersonMax: pricing?.perPersonMax || null,
            pricingAssumptions: pricing?.assumptions || [],
            weatherOverview: weather
              ? {
                  avgHigh: weather.avgHigh,
                  avgLow: weather.avgLow,
                  conditions: weather.conditions,
                }
              : null,
            sampleItinerary: itinerary,
            amenities: result.amenities,
            highlights: result.highlights,
            considerations: result.considerations,
            contactInfo: result.contactInfo,
          });
        }

        // Sort web matches by score
        webMatches.sort((a, b) => b.matchScore - a.matchScore);
        console.log(`[Search Agent] Processed ${webMatches.length} web matches`);
      }
    } catch (webError) {
      console.error("[Search Agent] Web search error:", webError);
      // Continue with database results only
    } finally {
      // Cleanup browser resources
      await cleanupBrowser();
    }

    // ========================================
    // PHASE 3: Collate Results
    // ========================================
    console.log("[Search Agent] Phase 3: Collating results...");

    // Clear existing search results for this inquiry
    await prisma.searchResult.deleteMany({
      where: { inquiryId },
    });

    // Store database matches first
    const allMatches: ResortMatch[] = [...dbMatches, ...webMatches];

    if (allMatches.length > 0) {
      // Create search results - database results first
      for (const match of dbMatches) {
        await prisma.searchResult.create({
          data: {
            inquiryId,
            resortId: match.resortId,
            source: "database",
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
          },
        });
      }

      // Store web results with proper fields
      for (const match of webMatches) {
        await prisma.searchResult.create({
          data: {
            inquiryId,
            resortId: null, // No database resort
            source: "web",
            webResortName: match.resortName,
            webResortUrl: match.contactInfo.website,
            webDescription: match.description,
            webAmenities: match.amenities,
            webHighlights: match.highlights,
            webConsiderations: match.considerations,
            webContactPhone: match.contactInfo.phone,
            webContactEmail: match.contactInfo.email,
            matchScore: new Decimal(match.matchScore),
            availabilityMatch: true, // Assumed from web
            capacityMatch: true, // Verified by Gemini
            priceMatch: null,
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
            pricingAssumptions: match.pricingAssumptions,
            weatherOverview: match.weatherOverview
              ? (match.weatherOverview as Prisma.InputJsonValue)
              : Prisma.DbNull,
            sampleItinerary: match.sampleItinerary
              ? (match.sampleItinerary as Prisma.InputJsonValue)
              : Prisma.DbNull,
            notes: null,
          },
        });
      }
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
          databaseMatchCount: dbMatches.length,
          webMatchCount: webMatches.length,
          totalMatchCount: allMatches.length,
          topDatabaseMatches: dbMatches.slice(0, 3).map((m) => ({
            name: m.resortName,
            score: m.matchScore,
            source: m.source,
          })),
          topWebMatches: webMatches.slice(0, 3).map((m) => ({
            name: m.resortName,
            score: m.matchScore,
            source: m.source,
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
          databaseResortCount: resorts.length,
          databaseMatchCount: dbMatches.length,
          webMatchCount: webMatches.length,
          totalMatchCount: allMatches.length,
          durationMs,
        },
      },
    });

    console.log(`[Search Agent] Completed in ${durationMs}ms`);
    console.log(`[Search Agent] Database matches: ${dbMatches.length}, Web matches: ${webMatches.length}`);

    return {
      success: true,
      data: {
        databaseMatchCount: dbMatches.length,
        webMatchCount: webMatches.length,
        totalMatchCount: allMatches.length,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    console.error("[Search Agent] Error:", errorMessage);

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

async function evaluateDatabaseResort(
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
    destination: string;
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
    primaryEmail: string;
    websiteUrl: string | null;
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
  },
  destinationLabel: string
): Promise<DatabaseResortMatch> {
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

  // Calculate estimated price
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

  const roomType = inquiry.roomType || "double";
  const roomTypeLabel =
    {
      single: "Single occupancy",
      double: "Double occupancy",
      triple: "Triple occupancy",
      quad: "Quad occupancy",
    }[roomType] || "Double occupancy";

  if (basePricePerGolfer > 0 || basePricePerRoom > 0) {
    const golfCost =
      basePricePerGolfer * inquiry.numberOfGolfers * inquiry.roundsPerGolfer;
    const roomCost =
      basePricePerRoom * inquiry.numberOfRooms * inquiry.numberOfNights;

    estimatedTotal = golfCost + roomCost;

    const varianceLow = 0.85;
    const varianceHigh = 1.15;

    priceBreakdown = {
      golf: golfCost,
      rooms: roomCost,
      resortFees: estimatedTotal * 0.05,
      total: estimatedTotal,
    };

    pricingAssumptions.push(roomTypeLabel);
    pricingAssumptions.push("Standard peak-season rates");
    pricingAssumptions.push("Estimated resort fees included");
    pricingAssumptions.push("Green fees based on standard rates");
    pricingAssumptions.push("Cart fees included");

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
        break;
      }
    }

    estimatedMin = Math.round(estimatedTotal * varianceLow);
    estimatedMax = Math.round(estimatedTotal * varianceHigh);
    perPersonMin = Math.round(estimatedMin / inquiry.numberOfGolfers);
    perPersonMax = Math.round(estimatedMax / inquiry.numberOfGolfers);

    if (inquiry.budgetMin || inquiry.budgetMax) {
      const min = inquiry.budgetMin ? Number(inquiry.budgetMin) : 0;
      const max = inquiry.budgetMax ? Number(inquiry.budgetMax) : Infinity;
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

  score = Math.max(0, Math.min(100, score));

  // Get real weather data
  const weather = await getWeatherForLocation(destinationLabel, inquiry.arrivalDate);

  // Generate itinerary
  const itinerary = await generateItinerary(
    resort.name,
    inquiry.numberOfNights,
    inquiry.roundsPerGolfer,
    inquiry.numberOfGolfers,
    destinationLabel
  );

  return {
    resortId: resort.id,
    resortName: resort.name,
    matchScore: score,
    source: "database",
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
    weatherOverview: weather
      ? {
          avgHigh: weather.avgHigh,
          avgLow: weather.avgLow,
          conditions: weather.conditions,
        }
      : null,
    sampleItinerary: itinerary,
    notes,
    contactInfo: {
      email: resort.primaryEmail,
      website: resort.websiteUrl || undefined,
    },
  };
}
