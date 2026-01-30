// Gemini AI integration for analyzing and compiling search results

import { GoogleGenerativeAI } from "@google/generative-ai";

interface ResortAnalysis {
  name: string;
  location: string;
  description: string;
  estimatedPriceRange: string | null;
  groupFriendly: boolean;
  amenities: string[];
  courses: string[];
  accommodationType: string | null;
  contactInfo: {
    phone?: string;
    email?: string;
    website?: string;
  };
  highlights: string[];
  considerations: string[];
  overallScore: number; // 1-100
}

interface WebSearchResult {
  name: string;
  url: string;
  description: string;
  location: string;
  phoneNumber?: string;
  email?: string;
  amenities: string[];
  groupCapacity?: string;
  priceRange?: string;
}

interface InquiryContext {
  destination: string;
  numberOfGolfers: number;
  numberOfNights: number;
  roundsPerGolfer: number;
  numberOfRooms: number;
  budgetMin?: number;
  budgetMax?: number;
  specialRequests?: string;
}

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("Gemini API key not configured");
    return null;
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  return genAI;
}

export async function analyzeResortResults(
  webResults: WebSearchResult[],
  inquiry: InquiryContext
): Promise<ResortAnalysis[]> {
  const client = getGeminiClient();

  if (!client) {
    // Return basic analysis without AI if no API key
    return webResults.map((result) => ({
      name: result.name,
      location: result.location,
      description: result.description,
      estimatedPriceRange: result.priceRange || null,
      groupFriendly: result.groupCapacity
        ? parseInt(result.groupCapacity) >= inquiry.numberOfGolfers
        : true,
      amenities: result.amenities,
      courses: [],
      accommodationType: null,
      contactInfo: {
        phone: result.phoneNumber,
        email: result.email,
        website: result.url,
      },
      highlights: result.amenities.slice(0, 3),
      considerations: [],
      overallScore: 70,
    }));
  }

  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are a golf travel expert analyzing resort options for a group golf trip.

Trip Requirements:
- Destination: ${inquiry.destination}
- Number of Golfers: ${inquiry.numberOfGolfers}
- Number of Nights: ${inquiry.numberOfNights}
- Rounds per Golfer: ${inquiry.roundsPerGolfer}
- Rooms Needed: ${inquiry.numberOfRooms}
${inquiry.budgetMin || inquiry.budgetMax ? `- Budget: $${inquiry.budgetMin || 0} - $${inquiry.budgetMax || "unlimited"}` : ""}
${inquiry.specialRequests ? `- Special Requests: ${inquiry.specialRequests}` : ""}

Analyze these golf resort search results and provide structured analysis for each:

${JSON.stringify(webResults, null, 2)}

For each resort, provide a JSON response with this structure:
{
  "resorts": [
    {
      "name": "Resort Name",
      "location": "City, State",
      "description": "Brief description",
      "estimatedPriceRange": "$X,XXX - $X,XXX per person" or null,
      "groupFriendly": true/false,
      "amenities": ["amenity1", "amenity2"],
      "courses": ["Course Name 1", "Course Name 2"],
      "accommodationType": "Resort rooms/Villas/Condos/etc",
      "highlights": ["Key selling point 1", "Key selling point 2", "Key selling point 3"],
      "considerations": ["Any concerns or notes"],
      "overallScore": 1-100 based on fit for this trip
    }
  ]
}

Focus on:
1. Whether each resort can accommodate a group of ${inquiry.numberOfGolfers} golfers
2. Estimated pricing if mentioned or inferable
3. Quality of golf courses
4. Group-friendly amenities and packages
5. Overall suitability for this specific trip

Return ONLY valid JSON, no markdown or other text.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON response
    try {
      // Clean up response - remove markdown code blocks if present
      let cleanJson = response.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }

      const parsed = JSON.parse(cleanJson.trim());

      // Merge AI analysis with original contact info
      return parsed.resorts.map((resort: ResortAnalysis, index: number) => ({
        ...resort,
        contactInfo: {
          phone: webResults[index]?.phoneNumber || resort.contactInfo?.phone,
          email: webResults[index]?.email || resort.contactInfo?.email,
          website: webResults[index]?.url || resort.contactInfo?.website,
        },
      }));
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", response);

      // Fall back to basic analysis
      return webResults.map((result) => ({
        name: result.name,
        location: result.location,
        description: result.description,
        estimatedPriceRange: null,
        groupFriendly: true,
        amenities: result.amenities,
        courses: [],
        accommodationType: null,
        contactInfo: {
          phone: result.phoneNumber,
          email: result.email,
          website: result.url,
        },
        highlights: [],
        considerations: [],
        overallScore: 60,
      }));
    }
  } catch (error) {
    console.error("Gemini analysis error:", error);

    // Return basic analysis on error
    return webResults.map((result) => ({
      name: result.name,
      location: result.location,
      description: result.description,
      estimatedPriceRange: null,
      groupFriendly: true,
      amenities: result.amenities,
      courses: [],
      accommodationType: null,
      contactInfo: {
        phone: result.phoneNumber,
        email: result.email,
        website: result.url,
      },
      highlights: [],
      considerations: [],
      overallScore: 50,
    }));
  }
}

export async function generateItinerary(
  resortName: string,
  numberOfNights: number,
  roundsPerGolfer: number,
  numberOfGolfers: number,
  destination: string
): Promise<Array<{ day: number; activities: string[] }>> {
  const client = getGeminiClient();

  if (!client) {
    // Return basic itinerary without AI
    return generateBasicItinerary(numberOfNights, roundsPerGolfer, resortName);
  }

  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Create a detailed golf trip itinerary for a group trip.

Details:
- Resort: ${resortName}
- Location: ${destination}
- Number of Nights: ${numberOfNights}
- Rounds per Golfer: ${roundsPerGolfer}
- Group Size: ${numberOfGolfers} golfers

Create a day-by-day itinerary that includes:
- Arrival and departure logistics
- Golf rounds (morning and/or afternoon)
- Meals (breakfast, lunch, dinner)
- Group activities
- Free time/spa time

Return ONLY valid JSON in this format:
{
  "itinerary": [
    {
      "day": 1,
      "activities": ["Activity 1", "Activity 2", "Activity 3"]
    }
  ]
}

Make it realistic and appropriate for a golf buddy trip. Include specific meal suggestions and group activities.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    try {
      let cleanJson = response.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }

      const parsed = JSON.parse(cleanJson.trim());
      return parsed.itinerary;
    } catch (parseError) {
      console.error("Failed to parse itinerary response:", parseError);
      return generateBasicItinerary(numberOfNights, roundsPerGolfer, resortName);
    }
  } catch (error) {
    console.error("Itinerary generation error:", error);
    return generateBasicItinerary(numberOfNights, roundsPerGolfer, resortName);
  }
}

function generateBasicItinerary(
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
        activities.push("Morning round (18 holes)");
        roundsScheduled++;
      }
      if (roundsScheduled < roundsPerGolfer && day < numberOfNights) {
        activities.push("Lunch at clubhouse");
        activities.push("Afternoon round (18 holes)");
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

export async function estimatePricing(
  resortName: string,
  destination: string,
  numberOfGolfers: number,
  numberOfNights: number,
  roundsPerGolfer: number,
  numberOfRooms: number
): Promise<{
  estimatedMin: number;
  estimatedMax: number;
  perPersonMin: number;
  perPersonMax: number;
  assumptions: string[];
} | null> {
  const client = getGeminiClient();

  if (!client) {
    // Return rough estimate without AI
    const basePerPerson = 350; // Base estimate per person per night for golf resort
    const golfCostPerRound = 150;

    const accommodationCost = basePerPerson * numberOfNights * numberOfGolfers;
    const golfCost = golfCostPerRound * roundsPerGolfer * numberOfGolfers;
    const total = accommodationCost + golfCost;

    return {
      estimatedMin: Math.round(total * 0.8),
      estimatedMax: Math.round(total * 1.3),
      perPersonMin: Math.round((total * 0.8) / numberOfGolfers),
      perPersonMax: Math.round((total * 1.3) / numberOfGolfers),
      assumptions: [
        "Standard resort accommodations",
        "Peak season rates assumed",
        "Cart fees included",
        "Estimate based on typical golf resort pricing",
      ],
    };
  }

  try {
    const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Estimate pricing for a golf trip package.

Details:
- Resort: ${resortName}
- Location: ${destination}
- Number of Golfers: ${numberOfGolfers}
- Number of Nights: ${numberOfNights}
- Rounds per Golfer: ${roundsPerGolfer}
- Rooms Needed: ${numberOfRooms}

Based on typical pricing for golf resorts in this area, provide a realistic price estimate.

Return ONLY valid JSON:
{
  "estimatedMin": total_min_price_number,
  "estimatedMax": total_max_price_number,
  "perPersonMin": per_person_min_number,
  "perPersonMax": per_person_max_number,
  "assumptions": ["assumption1", "assumption2", "assumption3"]
}

Be realistic based on the destination and resort type. Include assumptions about what's included.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    try {
      let cleanJson = response.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      }
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }

      return JSON.parse(cleanJson.trim());
    } catch (parseError) {
      console.error("Failed to parse pricing response:", parseError);
      return null;
    }
  } catch (error) {
    console.error("Pricing estimation error:", error);
    return null;
  }
}
