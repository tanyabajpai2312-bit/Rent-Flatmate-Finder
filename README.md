# Rent & Flatmate Finder

A full-stack platform where owners list rooms and tenants create "looking for room" profiles.
An LLM-powered compatibility engine scores and ranks matches, real-time chat unlocks once
interest is accepted, and email notifications fire on key events.

## Tech Stack

| Layer        | Choice |
|--------------|--------|
| Backend      | Node.js, Express |
| Database     | SQLite via Prisma ORM (swap to Postgres by changing one line — see below) |
| Auth         | JWT + bcrypt, role-based (`TENANT` / `OWNER` / `ADMIN`) |
| Real-time    | Socket.IO (WebSocket) with JWT-authenticated sockets |
| LLM          | Anthropic Claude API (`claude-3-5-haiku`) with deterministic rule-based fallback |
| Email        | Nodemailer (any SMTP — Gmail App Password, Brevo, Mailtrap free tier, etc.) |
| Frontend     | React 18 + Vite, React Router, Axios, socket.io-client |

## Project Structure

```
rent-flatmate-finder/
├── backend/
│   ├── prisma/schema.prisma       # DB schema (User, TenantProfile, Listing,
│   │                               #  CompatibilityScore, Interest, Message)
│   ├── src/
│   │   ├── server.js              # Express + Socket.IO entry point
│   │   ├── prismaClient.js
│   │   ├── middleware/             # auth.js (JWT), role.js (RBAC)
│   │   ├── routes/                 # auth, listings, interests, chat, admin
│   │   ├── services/
│   │   │   ├── llmService.js       # Calls Claude, builds prompt
│   │   │   ├── scoringFallback.js  # Rule-based fallback scorer
│   │   │   └── emailService.js     # Nodemailer + notification helpers
│   │   ├── sockets/chatSocket.js   # Real-time chat, auth'd, persists messages
│   │   └── seed.js                 # Demo data (admin/owner/tenant + listings)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Login, Register, Tenant/Owner/Admin dashboards, Chat
│   │   ├── components/             # Navbar, ListingCard
│   │   ├── context/AuthContext.jsx
│   │   └── api/axios.js
│   └── .env.example
└── SYSTEM_DESIGN.md                # 800-word design write-up
```

## Local Setup

### Prerequisites
- Node.js 18+
- npm

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `JWT_SECRET` — any long random string
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com/ (optional — if omitted or the
  call fails, the app automatically falls back to rule-based scoring, so the app still works
  end-to-end without a key)
- `SMTP_USER` / `SMTP_PASS` — optional; if omitted, emails are logged to console instead of sent

```bash
npx prisma migrate dev --name init   # creates dev.db and applies schema
npm run seed                          # optional: demo admin/owner/tenant + 2 listings
npm run dev                           # starts API on http://localhost:5000
```

Demo accounts created by `npm run seed` (password for all: `Password123!`):
- `admin@demo.com`
- `owner@demo.com`
- `tenant@demo.com` (profile: Koramangala, ₹8,000–₹15,000 budget)

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev             # starts on http://localhost:5173
```

Open http://localhost:5173, register as an Owner and a Tenant (two browser profiles or
incognito), post a listing as the owner, and watch it appear ranked by compatibility score
for the tenant.

## Switching to PostgreSQL for production

In `backend/prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
to:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
then set `DATABASE_URL` to your Postgres connection string (Render/Railway/Neon all provide
one for free) and run `npx prisma migrate deploy`.

## API Documentation

All authenticated routes require `Authorization: Bearer <token>`.

### Auth
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, role, preferredLocation?, budgetMin?, budgetMax?, moveInDate? }` | Tenant fields required only when `role: "TENANT"` |
| POST | `/api/auth/login` | `{ email, password }` | Returns `{ token, user }` |

### Listings
| Method | Route | Role | Notes |
|---|---|---|---|
| POST | `/api/listings` | OWNER | Create a listing |
| GET | `/api/listings?location=&minRent=&maxRent=` | any | Tenants get results ranked by cached compatibility score |
| GET | `/api/listings/mine` | OWNER | Owner's own listings with interest requests |
| PATCH | `/api/listings/:id/fill` | OWNER | Marks filled; hidden from search |

### Interests
| Method | Route | Role | Notes |
|---|---|---|---|
| POST | `/api/interests` | TENANT | `{ listingId }`. Emails owner if score ≥ threshold (default 80) |
| PATCH | `/api/interests/:id` | OWNER | `{ status: "ACCEPTED" \| "DECLINED" }`. Emails tenant |
| GET | `/api/interests/mine` | TENANT | Tenant's sent requests with status |

### Chat
| Method | Route | Notes |
|---|---|---|
| GET | `/api/chat/:interestId/messages` | REST history (only after ACCEPTED, participants only) |

**WebSocket events** (`socket.io`, auth via `{ auth: { token } }` on connect):
- `join_chat` → `{ interestId }`
- `joined_chat` ← confirmation
- `send_message` → `{ interestId, content }`
- `new_message` ← persisted message broadcast to the room
- `error_message` ← e.g. unauthorized, not yet accepted

### Admin
| Method | Route |
|---|---|
| GET / DELETE | `/api/admin/users`, `/api/admin/users/:id` |
| GET / DELETE | `/api/admin/listings`, `/api/admin/listings/:id` |
| GET | `/api/admin/activity` |

## Database Schema (summary)

- **User**: id, name, email, passwordHash, role (`TENANT`/`OWNER`/`ADMIN`)
- **TenantProfile**: 1:1 with User — preferredLocation, budgetMin, budgetMax, moveInDate
- **Listing**: owner (User), location, rent, availableFrom, roomType, furnishingStatus, photos, isFilled
- **CompatibilityScore**: unique per (listing, tenant) — score, explanation, source (`llm` | `rule-based-fallback`). Computed once and cached, never recomputed on every request.
- **Interest**: unique per (tenant, listing) — status (`PENDING`/`ACCEPTED`/`DECLINED`)
- **Message**: belongs to an Interest — senderId, content, createdAt (persisted chat history)

## LLM Prompt & Example I/O

Prompt template (`backend/src/services/llmService.js`):
```
Given this room listing: {location, rent, availableFrom, roomType, furnishingStatus}
and this tenant profile: {preferredLocation, budgetMin, budgetMax, moveInDate},
compute a compatibility score from 0 to 100 based on budget and location match.
Respond with ONLY valid JSON: {"score": number, "explanation": string}
```

Example input:
```json
{
  "listing": { "location": "Koramangala", "rent": 12000, "roomType": "Single", "furnishingStatus": "FULLY_FURNISHED" },
  "tenant":  { "preferredLocation": "Koramangala", "budgetMin": 8000, "budgetMax": 15000 }
}
```

Example output:
```json
{ "score": 92, "explanation": "Exact location match and rent comfortably within budget range." }
```

If the LLM call fails, times out (8s default), or returns malformed JSON, `scoringFallback.js`
computes a deterministic score from location match (up to 60 pts) + budget fit (up to 40 pts),
labeled `source: "rule-based-fallback"` so the UI can show a transparency note.

## Evaluation Checklist Coverage

- ✅ AI compatibility scoring with graceful LLM fallback
- ✅ Real-time chat (Socket.IO) with message persistence in DB
- ✅ Email notification flow (high-score interest → owner; accept/decline → tenant)
- ✅ Role-based auth (tenant/owner/admin) end to end
- ✅ Database schema with proper relations and uniqueness constraints
- ✅ RESTful API design + WebSocket events documented above
- ✅ Filled listings hidden from search
- ✅ Admin can manage users/listings and view activity stats
