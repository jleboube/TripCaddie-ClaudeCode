import { Resend } from "resend";

// Lazy-load Resend client to avoid initialization errors when API key is not set
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

interface BookingEmailData {
  inquiryNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  arrivalDate: Date;
  departureDate: Date;
  numberOfNights: number;
  numberOfGolfers: number;
  roundsPerGolfer: number;
  numberOfRooms: number;
  roomType?: string;
  specialRequests?: string;
  resortName: string;
  estimatedTotal?: number;
}

export async function sendEmail(options: EmailOptions) {
  const client = getResendClient();

  if (!client) {
    console.warn("Email sending disabled: RESEND_API_KEY not configured");
    return { success: true, messageId: "email-disabled", skipped: true };
  }

  const from = process.env.EMAIL_FROM || "noreply@tripcaddie.com";

  try {
    const result = await client.emails.send({
      from,
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}

export function generateBookingRequestEmail(data: BookingEmailData): string {
  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Booking Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 600; color: #6b7280; margin-bottom: 8px; text-transform: uppercase; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-label { color: #6b7280; }
    .detail-value { font-weight: 500; }
    .highlight { background: #dcfce7; padding: 12px; border-radius: 6px; margin-top: 16px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">New Booking Request</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Inquiry #${data.inquiryNumber}</p>
    </div>

    <div class="content">
      <div class="section">
        <div class="section-title">Contact Information</div>
        <div class="detail-row">
          <span class="detail-label">Name</span>
          <span class="detail-value">${data.contactName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value">${data.contactEmail}</span>
        </div>
        ${
          data.contactPhone
            ? `
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${data.contactPhone}</span>
        </div>
        `
            : ""
        }
      </div>

      <div class="section">
        <div class="section-title">Trip Details</div>
        <div class="detail-row">
          <span class="detail-label">Resort</span>
          <span class="detail-value">${data.resortName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Arrival</span>
          <span class="detail-value">${formatDate(data.arrivalDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Departure</span>
          <span class="detail-value">${formatDate(data.departureDate)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Nights</span>
          <span class="detail-value">${data.numberOfNights}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Golfers</span>
          <span class="detail-value">${data.numberOfGolfers}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Rounds per Golfer</span>
          <span class="detail-value">${data.roundsPerGolfer}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Rooms</span>
          <span class="detail-value">${data.numberOfRooms}${data.roomType ? ` (${data.roomType})` : ""}</span>
        </div>
      </div>

      ${
        data.specialRequests
          ? `
      <div class="section">
        <div class="section-title">Special Requests</div>
        <p style="margin: 0;">${data.specialRequests}</p>
      </div>
      `
          : ""
      }

      ${
        data.estimatedTotal
          ? `
      <div class="highlight">
        <strong>Estimated Total:</strong> ${formatCurrency(data.estimatedTotal)}
      </div>
      `
          : ""
      }
    </div>

    <div class="footer">
      <p>This booking request was generated by TripCaddie IQBE</p>
      <p>Please respond to the guest at ${data.contactEmail}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendBookingRequest(
  data: BookingEmailData,
  resortEmails: string[]
) {
  const html = generateBookingRequestEmail(data);

  return sendEmail({
    to: resortEmails,
    subject: `New Golf Trip Booking Request - ${data.inquiryNumber}`,
    html,
    replyTo: data.contactEmail,
  });
}
