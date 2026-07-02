# System Design Write-Up

## Compatibility Scoring Design

Compatibility scoring lives behind a single function, `getCompatibilityScore(listing,
tenantProfile)`, called from the listings route the first time a tenant views a given listing.
The result — `{ score, explanation, source }` — is written to a `CompatibilityScore` row
keyed by a unique `(listingId, tenantId)` pair. On every subsequent request the route checks
for an existing row before calling the LLM again, satisfying the requirement that scores are
"stored and not recomputed on every request." This also keeps API costs predictable: a
tenant browsing the same listing repeatedly costs exactly one LLM call, not one per page
load. The `source` field (`"llm"` vs `"rule-based-fallback"`) is surfaced in the UI so users
know when they're seeing an AI judgment versus a deterministic estimate — a small touch that
builds trust and makes the fallback path testable/demonstrable rather than invisible.

Scores are used in two places: ranking the tenant's listing feed (`GET /api/listings` sorts
by `compatibility.score` descending for any authenticated tenant with a profile), and gating
the high-compatibility email notification when a tenant expresses interest.

## LLM Integration and Fallback

`llmService.js` builds the prompt exactly as specified in the assignment brief, sends it to
Claude via the Messages API, and parses the response as strict JSON. Three failure modes are
handled explicitly rather than left to bubble up as 500 errors:

1. **No API key configured** — the service skips the network call entirely and returns the
   fallback immediately. This means the application is fully runnable and demoable without
   any LLM credentials, which matters for graders who may not want to provision a key.
2. **Network/timeout failure** — an `AbortController` enforces an 8-second timeout (configurable
   via `LLM_TIMEOUT_MS`), so a slow or hanging API never stalls a listings page load.
3. **Malformed output** — if the model doesn't return valid JSON or the score isn't a number,
   the response is rejected and treated the same as a hard failure.

In every failure case, control passes to `scoringFallback.js`, a deterministic rule-based
scorer: up to 60 points for location match (exact match scores higher than a substring/partial
match), and up to 40 points for budget fit (rent inside the tenant's range scores highest,
scaled by how centered it is in the range; rent outside the range decays proportionally to
the overshoot). This guarantees every listing always has *some* score and explanation — the
feature degrades gracefully instead of breaking the ranking or interest flow. Because both
paths return the same shape (`{ score, explanation, source }`), the rest of the application
(API routes, frontend rendering) is completely agnostic to which path produced the result.

## Chat Implementation

Chat is built on Socket.IO rather than raw WebSockets to get automatic reconnection, room
management, and a clean event API with minimal code. A `socket.io` middleware authenticates
every connection using the same JWT issued at login (`io.use` verifies the token before the
`connection` event fires), so unauthenticated clients are rejected before they can join any
room.

Each accepted `Interest` maps to one Socket.IO room (`interestId`). On `join_chat`, the
server re-validates that the requesting socket's user is either the tenant or the listing
owner on that interest, and that the interest's status is `ACCEPTED` — chat is intentionally
locked until both routes (REST `join_chat` validation and the React UI, which only renders a
"Open chat" link for accepted interests) agree it should be available. On `send_message`, the
server persists the message to the `Message` table *before* broadcasting it via
`io.to(interestId).emit('new_message', ...)`, so a message is never lost if a client
disconnects mid-broadcast, and a fresh page load can always reconstruct full history via
`GET /api/chat/:interestId/messages`. This persist-then-broadcast ordering, plus the
participant check repeated on both `join_chat` and `send_message`, are the two design choices
that most directly support correctness and security here.

## Notification Flow

Email is isolated behind `emailService.js`, which wraps Nodemailer and never throws — failures
are logged and return `{ sent: false }` rather than propagating, so a misconfigured SMTP
server can't break the interest/accept/decline flow that triggered the email. Two flows are
implemented:

1. **Tenant expresses interest** (`POST /api/interests`): after creating the `Interest` row,
   the server reads the cached `CompatibilityScore` for that pair; if `score >=
   HIGH_COMPATIBILITY_THRESHOLD` (env-configurable, default 80), the owner is emailed
   immediately, synchronously within the request — acceptable at this scale, and easy to move
   to a queue (BullMQ/SQS) later without changing the service's interface.
2. **Owner accepts/declines** (`PATCH /api/interests/:id`): the tenant is emailed the decision
   regardless of outcome, so they're never left wondering about a pending request.
