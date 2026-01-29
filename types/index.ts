import type {
  Inquiry,
  Resort,
  SearchResult,
  BookingRequest,
  AgentExecution,
  User,
  InquiryStatus,
  AgentType,
  AgentExecutionStatus,
  BookingDeliveryStatus,
} from "@prisma/client";

export type {
  Inquiry,
  Resort,
  SearchResult,
  BookingRequest,
  AgentExecution,
  User,
  InquiryStatus,
  AgentType,
  AgentExecutionStatus,
  BookingDeliveryStatus,
};

export interface InquiryWithRelations extends Inquiry {
  searchResults?: SearchResult[];
  bookingRequests?: BookingRequest[];
  agentExecutions?: AgentExecution[];
}

export interface ResortWithRelations extends Resort {
  searchResults?: SearchResult[];
  bookingRequests?: BookingRequest[];
}

export interface SearchResultWithRelations extends SearchResult {
  resort?: Resort;
  inquiry?: Inquiry;
}

export interface QuoteFormData {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  arrivalDate: Date;
  departureDate: Date;
  numberOfGolfers: number;
  roundsPerGolfer: number;
  numberOfRooms: number;
  roomType?: string;
  preferredResorts?: string[];
  budgetMin?: number;
  budgetMax?: number;
  specialRequests?: string;
}

export interface AgentJobData {
  inquiryId: string;
}

export interface BookingAgentJobData extends AgentJobData {
  resortIds: string[];
}

export interface AgentResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: string[];
}

export interface DashboardStats {
  totalInquiries: number;
  pendingInquiries: number;
  completedInquiries: number;
  totalResorts: number;
  activeResorts: number;
  conversionRate: number;
}
