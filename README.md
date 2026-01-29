<h1 align="center">TripCaddie IQBE</h1>

<p align="center">
  <strong>Intelligent Quote & Booking Engine for Golf Trip Planning</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=fff" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=000" alt="React"/>
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=fff" alt="Tailwind CSS"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=fff" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=fff" alt="Prisma"/>
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=fff" alt="Redis"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=fff" alt="Docker"/>
</p>

<p align="center">
  An agent-driven platform that automates golf trip quoting and booking. Customers submit trip requests through a public form, and intelligent agents validate inquiries, match resorts, calculate pricing, and send booking requests automatically.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#agent-pipeline">Agent Pipeline</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## Features

- **Public Quote Form** - Customer-facing form with destination selection and trip details
- **Intelligent Agents** - Background agents that process, match, and book automatically
- **Resort Matching** - Smart matching based on dates, capacity, pricing, and preferences
- **Price Ranges** - Estimated pricing with min/max ranges (never single prices)
- **Per-Person Pricing** - Automatic per-golfer cost calculations
- **Weather Overview** - Historical weather data for travel dates
- **Sample Itineraries** - Auto-generated day-by-day trip schedules
- **PII Encryption** - AES-256 encryption for all contact information
- **Admin Dashboard** - Manage inquiries, resorts, and agent executions
- **Audit Logging** - Complete trail of all system actions
- **Docker Deployment** - One-command deployment with Docker Compose

## Agent Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Request Agent  │────▶│  Search Agent   │────▶│  Booking Agent  │
│                 │     │                 │     │                 │
│ • Validate data │     │ • Match resorts │     │ • Compile quote │
│ • Normalize     │     │ • Calculate $$  │     │ • Send emails   │
│ • Generate ID   │     │ • Add weather   │     │ • Track status  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
   PENDING ───────▶ REQUEST_ACCEPTED ───────▶ SEARCH_COMPLETED ───────▶ BOOKING_SENT
```

### Request Agent
- Validates all required fields
- Normalizes phone numbers, emails, and names
- Generates human-readable inquiry numbers (TC-2024-0001)
- Triggers Search Agent on success

### Search Agent
- Queries active resorts matching criteria
- Scores matches by date, capacity, and price fit
- Calculates price ranges (±15% variance)
- Adds weather data and sample itineraries
- Creates SearchResult records

### Booking Agent
- Compiles booking request payload
- Sends emails to matched resorts
- Tracks delivery status
- Updates inquiry to final status

## Tech Stack

### Frontend
- **Next.js 14** - App Router with React Server Components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible components
- **Lucide Icons** - Modern icon library

### Backend
- **Next.js API Routes** - Serverless API endpoints
- **Prisma ORM** - Type-safe database access
- **NextAuth.js** - Authentication with credentials provider
- **BullMQ** - Redis-backed job queue for agents
- **Zod** - Schema validation

### Infrastructure
- **PostgreSQL** - Primary database
- **Redis** - Queue backend and caching
- **Docker** - Containerized deployment
- **Docker Compose** - Multi-container orchestration

## Quick Start

### Prerequisites
- Docker and Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone https://gitea.my-house.dev/joe/TripCaddie-ClaudeCode.git
   cd TripCaddie-ClaudeCode
   ```

2. **Configure admin credentials**
   ```bash
   cp .env.example .env
   # Edit .env with your admin email/password
   ```

3. **Deploy**
   ```bash
   ./deploy.sh
   ```

   This single command:
   - Auto-generates cryptographic secrets (`.secrets` file)
   - Creates default `.env` if missing
   - Builds Docker images
   - Starts all containers

4. **Access the application**

   | Interface | URL |
   |-----------|-----|
   | Quote Form | http://localhost:47319/quote |
   | Admin Login | http://localhost:47319/admin/login |
   | Dashboard | http://localhost:47319/admin/dashboard |
   | Health Check | http://localhost:47319/api/health |

### Deployment Commands

```bash
./deploy.sh          # Build and start (default)
./deploy.sh down     # Stop containers
./deploy.sh restart  # Restart containers
./deploy.sh reset    # Delete all data and regenerate secrets
./deploy.sh logs     # View app logs
./deploy.sh logs db  # View specific service logs
```

## Configuration

### Environment Variables

The deployment uses two files:
- `.env` - User-specific settings you configure
- `.secrets` - Auto-generated cryptographic secrets

#### User Configuration (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `ADMIN_EMAIL` | Admin login email | Yes |
| `ADMIN_NAME` | Admin display name | Yes |
| `ADMIN_PASSWORD` | Admin login password | Yes |
| `NEXTAUTH_URL` | Application URL | No (default: localhost:47319) |
| `RESEND_API_KEY` | Email service API key | No (emails disabled if empty) |
| `EMAIL_FROM` | Sender email address | No |

#### Auto-Generated Secrets (.secrets)

These are created automatically on first `./deploy.sh`:

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password (32 chars) |
| `NEXTAUTH_SECRET` | Session encryption key (base64) |
| `ENCRYPTION_KEY` | AES-256 key for PII (base64) |

### Supported Destinations

| Destination | Location | Value |
|-------------|----------|-------|
| Pinehurst Golf Resort | NC | `pinehurst` |
| Destination Kohler / Whistling Straits | WI | `kohler` |
| Big Cedar Lodge | MO | `big-cedar` |
| Pebble Beach Resorts | CA | `pebble-beach` |
| Kiawah Island Golf Resort | SC | `kiawah` |
| Bandon Dunes Golf Resort | OR | `bandon-dunes` |
| Streamsong Resort | FL | `streamsong` |
| Other / Multiple | - | `other` |

### Quote Form Fields

| Field | Description | Required | Validation |
|-------|-------------|----------|------------|
| `contactName` | Customer name | Yes | 2-100 chars |
| `contactEmail` | Email address | Yes | Valid email |
| `contactPhone` | Phone number | Yes | 10+ digits |
| `destination` | Golf destination | Yes | From list |
| `arrivalDate` | Check-in date | Yes | Future date |
| `departureDate` | Check-out date | Yes | After arrival |
| `numberOfGolfers` | Group size | Yes | 1-100 |
| `roundsPerGolfer` | Rounds per person | Yes | 1-10 |
| `numberOfRooms` | Rooms needed | Yes | 1-50 |
| `roomType` | Occupancy type | Yes | single/double/triple/quad |
| `budgetMin` | Minimum budget | No | Positive number |
| `budgetMax` | Maximum budget | No | > budgetMin |
| `specialRequests` | Additional notes | No | Max 2000 chars |

### Agent Configuration

| Agent | Concurrency | Rate Limit | Retries |
|-------|-------------|------------|---------|
| Request Agent | 5 | 10/sec | 3 |
| Search Agent | 3 | - | 3 |
| Booking Agent | 2 | 5/min | 3 |

## Usage

### Submitting a Quote Request

1. Navigate to `/quote`
2. Select your destination
3. Enter travel dates and group details
4. Provide contact information
5. Submit the form
6. View confirmation with pricing estimates

### Managing Inquiries (Admin)

1. Log in at `/admin/login`
2. View all inquiries on the dashboard
3. Click an inquiry for full details
4. Retry failed agents if needed
5. Track agent execution history

### Adding Resorts (Admin)

1. Navigate to `/admin/resorts`
2. Click "Add Resort"
3. Enter resort details and capacity
4. Set pricing rules and availability
5. Save to make available for matching

## Project Structure

```
TripCaddie-ClaudeCode/
├── app/
│   ├── (admin)/              # Protected admin pages
│   │   ├── dashboard/
│   │   ├── inquiries/
│   │   └── resorts/
│   ├── (public)/             # Public pages
│   │   └── quote/
│   ├── api/                  # API routes
│   │   ├── auth/
│   │   ├── health/
│   │   ├── inquiries/
│   │   ├── quote/
│   │   └── resorts/
│   └── layout.tsx
├── components/
│   ├── admin/                # Admin components
│   ├── forms/                # Form components
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── agents/               # Agent implementations
│   │   ├── request-agent.ts
│   │   ├── search-agent.ts
│   │   └── booking-agent.ts
│   ├── auth.ts               # NextAuth config
│   ├── db.ts                 # Prisma client
│   ├── encryption.ts         # PII encryption
│   ├── queue.ts              # BullMQ queues
│   └── validation.ts         # Zod schemas
├── workers/
│   └── agent-worker.ts       # Background worker
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Initial data
├── docker-compose.yml
├── Dockerfile
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check with queue status |
| POST | `/api/quote` | Submit new quote request |
| GET | `/api/inquiries` | List all inquiries (admin) |
| GET | `/api/inquiries/[id]` | Get inquiry details (admin) |
| POST | `/api/inquiries/[id]/retry` | Retry failed agent (admin) |
| GET | `/api/resorts` | List all resorts (admin) |
| POST | `/api/resorts` | Create resort (admin) |
| GET | `/api/stats` | Dashboard statistics (admin) |

### API Request Example

```bash
curl -X POST "http://localhost:47319/api/quote" \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "John Smith",
    "contactEmail": "john@example.com",
    "contactPhone": "555-123-4567",
    "destination": "pinehurst",
    "arrivalDate": "2024-06-15",
    "departureDate": "2024-06-18",
    "numberOfGolfers": 4,
    "roundsPerGolfer": 3,
    "numberOfRooms": 2,
    "roomType": "double"
  }'
```

## Data Model

### Core Entities

| Entity | Description |
|--------|-------------|
| `Inquiry` | Customer quote request with encrypted PII |
| `Resort` | Golf resort with capacity and pricing rules |
| `SearchResult` | Match between inquiry and resort with scores |
| `BookingRequest` | Outbound booking email to resort |
| `AgentExecution` | Tracking record for each agent run |
| `AuditLog` | System-wide action log |

### Inquiry Status Flow

| Status | Description |
|--------|-------------|
| `PENDING` | Just submitted, awaiting processing |
| `REQUEST_ACCEPTED` | Validated by Request Agent |
| `SEARCH_COMPLETED` | Matched by Search Agent |
| `BOOKING_REQUEST_SENT` | Emails sent by Booking Agent |
| `FAILED` | Agent encountered an error |

## Troubleshooting

### Health check returns unhealthy

- Verify PostgreSQL is running: `docker compose logs db`
- Verify Redis is running: `docker compose logs redis`
- Check app logs: `docker compose logs app`

### Agents not processing

- Check worker status: `docker compose logs worker`
- Verify Redis connection in health check
- Check queue status in `/api/health` response

### Database connection fails

- Ensure DATABASE_URL matches docker-compose service name
- Wait for db container health check to pass
- Check postgres logs: `docker compose logs db`

### Login not working

- Verify ADMIN_EMAIL and ADMIN_PASSWORD in .env
- Reset database: `docker compose down -v && docker compose up -d`
- Check NEXTAUTH_SECRET is set

## License

MIT License - see LICENSE file for details.

---

<p align="center">
  Built with Next.js, Prisma, and BullMQ
</p>
