# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart Flashcard web app (website học từ vựng thông minh) with real-time multiplayer battle, spaced repetition, and deep Google Cloud integration. Production domain: `https://nhom12c365httt.live` / `https://cuoiki-cloud.pages.dev`.

## Commands

### Backend (Node.js + Express)
```bash
cd Backend
npm install
npm run dev        # nodemon src/index.js (hot reload)
npm start          # node src/index.js (production)
```

### Frontend (React + Vite)
```bash
cd Frontend
npm install
npm run dev        # Vite dev server on port 5173
npm run build      # Production build
npm run typecheck  # TypeScript check only (no emit)
```

### Full Stack with Docker
```bash
# From repo root — starts Backend (8080) + PostgreSQL (5432)
docker-compose up
```
Docker Compose auto-runs `npx prisma db push` on startup. The Backend Dockerfile targets Google Cloud Run (port 8080).

### Database (Prisma)
```bash
cd Backend
npx prisma db push          # Push schema changes to DB
npx prisma studio           # Open Prisma visual editor
npx prisma generate         # Regenerate Prisma client after schema changes
```

## Architecture

### Request Flow

```
Browser → REST API (Express) → Controller → Service → DB (Prisma/PostgreSQL)
                                                     → Google Cloud APIs
                                                     → Cloudflare R2

Browser → WebSocket (Socket.io) → Battle matchmaking + real-time game state

HTTP POST /api/decks → 202 Accepted → Pub/Sub publish → generationWorker.js
                                                          ├─ Batch translate (GCP Translate)
                                                          ├─ Text-to-Speech (GCP TTS)
                                                          ├─ Image (Loremflickr)
                                                          └─ Save to DB
```

### Backend (`Backend/src/`)

- **`index.js`** — Express + Socket.io entry point; CORS config, middleware wiring, route mounting, Socket.io battle event handlers (`join_battle`, `submit_answer`, `disconnect`)
- **`controllers/`** — Thin HTTP handlers; auth (Firebase + JWT), deck CRUD, flashcard CRUD + SM-2 review, battle score submission + email
- **`services/`**
  - `aiServices.js` — Batch translation, TTS audio generation, Loremflickr image fetch
  - `pubsubService.js` — Publishes deck generation tasks to Google Cloud Pub/Sub
  - `r2Service.js` — Cloudflare R2 (S3-compatible) audio file upload/retrieval
- **`workers/generationWorker.js`** — Long-running subscriber; orchestrates the full async deck generation pipeline
- **`middleware/authMiddleware.js`** — Dual-mode JWT verification: accepts both Firebase ID tokens and our own JWTs; normalizes `req.userId`

### Frontend (`Frontend/src/`)

- **`pages/`** — Route-level components: Login/Signup/ForgotPassword, Dashboard (deck grid), CreateDeck, StudyMode, StudyLibrary, BattleArena
- **`components/`** — `FlashcardComponent.tsx` (audio + image + flip), `DeckCard.tsx` (progress %), `TurnstileWidget.tsx` (Cloudflare bot protection), `ui/` (~40 shadcn/Radix UI primitives)
- **`context/AuthContext.tsx`** — Firebase auth state; provides `user`, `login`, `logout` to the whole app
- Path alias `@/*` maps to `Frontend/src/`

### Data Model (Prisma schema in `Backend/prisma/`)

Core entities: `User` → `Deck` → `Flashcard` (word, meaning, audioUrl, imageUrl) → `StudyProgress` (SM-2 fields: interval, repetition, easeFactor, nextReviewDate). `MatchHistory` stores battle results.

### Key Environment Variables (Backend/.env)

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # For our own token signing
FIREBASE_PROJECT_ID   # Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS  # Path to google-key.json (TTS + Translate + Pub/Sub)
R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME
PUBSUB_TOPIC_ID / PUBSUB_SUBSCRIPTION_ID
```

`google-key.json` is gitignored — required locally for GCP calls.

## Cloud Service Notes

- **Async deck generation**: The POST `/api/decks` endpoint returns `202` immediately; actual flashcard creation is async via Pub/Sub → worker. Poll deck status to detect completion.
- **TTS audio**: Generated once, stored in R2, URL saved to `Flashcard.audioUrl`. Batch calls are used to stay within GCP quotas.
- **Authentication**: `authMiddleware.js` accepts both Firebase ID tokens (from frontend Firebase SDK) and our JWT tokens. Both resolve to the same `req.userId`.
- **Battle rooms**: Stored in-memory in `index.js` (MVP). A Socket.io room represents one match; matchmaking uses a queue array.
- **CORS origins**: Hardcoded allowlist in `index.js` — update when adding new frontend domains.
