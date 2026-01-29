import { z } from "zod";

// Supported destinations per Original Prompt
export const DESTINATIONS = [
  { value: "pinehurst", label: "Pinehurst Golf Resort", state: "NC" },
  { value: "kohler", label: "Destination Kohler / Whistling Straits", state: "WI" },
  { value: "big-cedar", label: "Big Cedar Lodge", state: "MO" },
  { value: "pebble-beach", label: "Pebble Beach Resorts", state: "CA" },
  { value: "kiawah", label: "Kiawah Island Golf Resort", state: "SC" },
  { value: "bandon-dunes", label: "Bandon Dunes Golf Resort", state: "OR" },
  { value: "streamsong", label: "Streamsong Resort", state: "FL" },
  { value: "other", label: "Other / Multiple Destinations", state: "" },
] as const;

export const quoteFormSchema = z
  .object({
    contactName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters"),
    contactEmail: z.string().email("Please enter a valid email address"),
    contactPhone: z
      .string()
      .min(10, "Phone number is required")
      .refine(
        (val) => /^[\d\s\-+()]+$/.test(val),
        "Please enter a valid phone number"
      ),
    destination: z.string().min(1, "Please select a destination"),
    arrivalDate: z.coerce.date().refine((date) => date > new Date(), {
      message: "Arrival date must be in the future",
    }),
    departureDate: z.coerce.date(),
    numberOfGolfers: z
      .number()
      .int()
      .min(1, "At least 1 golfer required")
      .max(100, "Maximum 100 golfers"),
    roundsPerGolfer: z
      .number()
      .int()
      .min(1, "At least 1 round required")
      .max(10, "Maximum 10 rounds per golfer"),
    numberOfRooms: z
      .number()
      .int()
      .min(1, "At least 1 room required")
      .max(50, "Maximum 50 rooms"),
    roomType: z.string().default("double"),
    preferredResorts: z.array(z.string()).optional(),
    budgetMin: z.number().positive().optional(),
    budgetMax: z.number().positive().optional(),
    specialRequests: z
      .string()
      .max(2000, "Special requests must be less than 2000 characters")
      .optional(),
  })
  .refine((data) => data.departureDate > data.arrivalDate, {
    message: "Departure date must be after arrival date",
    path: ["departureDate"],
  })
  .refine(
    (data) =>
      !data.budgetMin || !data.budgetMax || data.budgetMax >= data.budgetMin,
    {
      message: "Maximum budget must be greater than minimum budget",
      path: ["budgetMax"],
    }
  );

export type QuoteFormInput = z.infer<typeof quoteFormSchema>;

export const resortSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  country: z.string().default("USA"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // New fields from Original Prompt
  highlights: z.array(z.string()).optional(), // Key selling points
  websiteUrl: z.string().url().optional(),
  maxGolfers: z.number().int().min(1),
  maxRooms: z.number().int().min(1),
  numberOfCourses: z.number().int().min(1).default(1),
  primaryEmail: z.string().email(),
  secondaryEmails: z.array(z.string().email()).optional(),
  basePricePerGolfer: z.number().positive().optional(),
  basePricePerRoom: z.number().positive().optional(),
  minimumNights: z.number().int().min(1).default(1),
  minimumGolfers: z.number().int().min(1).default(4),
  advanceBookingDays: z.number().int().min(0).default(7),
  isActive: z.boolean().default(true),
});

export type ResortInput = z.infer<typeof resortSchema>;

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Validation utilities for agents
export interface NormalizedInquiry {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  destination: string;
  arrivalDate: Date;
  departureDate: Date;
  numberOfNights: number;
  numberOfGolfers: number;
  roundsPerGolfer: number;
  numberOfRooms: number;
  roomType: string;
  preferredResorts: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  specialRequests: string | null;
}

export function normalizePhoneNumber(phone: string | null): string | null {
  if (!phone) return null;
  // Remove all non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, "");
  // Format as US phone if 10 digits
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return cleaned;
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizeName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function validateAndNormalizeInquiry(inquiry: {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  destination: string;
  arrivalDate: Date;
  departureDate: Date;
  numberOfNights: number;
  numberOfGolfers: number;
  roundsPerGolfer: number;
  numberOfRooms: number;
  roomType: string;
  preferredResorts: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  specialRequests: string | null;
}): { normalizedData: NormalizedInquiry; errors: string[] } {
  const errors: string[] = [];

  // Normalize values
  const normalizedData: NormalizedInquiry = {
    contactName: normalizeName(inquiry.contactName),
    contactEmail: normalizeEmail(inquiry.contactEmail),
    contactPhone: normalizePhoneNumber(inquiry.contactPhone) || inquiry.contactPhone,
    destination: inquiry.destination.trim().toLowerCase(),
    arrivalDate: inquiry.arrivalDate,
    departureDate: inquiry.departureDate,
    numberOfNights: inquiry.numberOfNights,
    numberOfGolfers: inquiry.numberOfGolfers,
    roundsPerGolfer: inquiry.roundsPerGolfer,
    numberOfRooms: inquiry.numberOfRooms,
    roomType: inquiry.roomType?.trim() || "double",
    preferredResorts: inquiry.preferredResorts,
    budgetMin: inquiry.budgetMin,
    budgetMax: inquiry.budgetMax,
    specialRequests: inquiry.specialRequests?.trim() || null,
  };

  // Validate
  if (normalizedData.arrivalDate <= new Date()) {
    errors.push("Arrival date must be in the future");
  }

  if (normalizedData.departureDate <= normalizedData.arrivalDate) {
    errors.push("Departure date must be after arrival date");
  }

  const calculatedNights = Math.ceil(
    (normalizedData.departureDate.getTime() -
      normalizedData.arrivalDate.getTime()) /
      (1000 * 60 * 60 * 24)
  );
  if (calculatedNights !== normalizedData.numberOfNights) {
    normalizedData.numberOfNights = calculatedNights;
  }

  if (normalizedData.numberOfRooms > normalizedData.numberOfGolfers) {
    errors.push("Number of rooms cannot exceed number of golfers");
  }

  if (
    normalizedData.budgetMin &&
    normalizedData.budgetMax &&
    normalizedData.budgetMax < normalizedData.budgetMin
  ) {
    errors.push("Maximum budget must be greater than minimum budget");
  }

  return { normalizedData, errors };
}
