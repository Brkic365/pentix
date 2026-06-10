# Pentix ⬠5

**Gol pada — ti padaš na sklekove.** Svaki gol na Svjetskom prvenstvu 2026 puni
sklek-dug cijele ekipe; kamera ti broji sklekove dok ga vraćaš, a kamata raste
dok dug stoji. Penta = 5: bazna tarifa je **5 sklekova po golu**.

Friends-scale web app: FIFA World Cup 2026 goals become pushup debt, paid off
by recording sets that an in-browser computer-vision counter tallies (MediaPipe
pose tracking). Live leaderboard, side bets, daily interest. Croatian-first UI.

## Stack

- **Next.js 15** (App Router) + TypeScript + Tailwind CSS v4
- **Clerk** — auth (email + OAuth), Croatian localization
- **Prisma + PostgreSQL (Supabase)** — pooled connection at runtime, direct for migrations
- **Cloudflare R2** — pushup-clip storage (S3-compatible, presigned uploads)
- **Supabase Realtime** — live leaderboard (10s polling fallback baked in)
- **@mediapipe/tasks-vision** — PoseLandmarker (WASM) pushup counting, fully client-side
- **Vercel** — hosting + daily interest cron

## Local setup

```bash
npm install
cp .env.example .env        # fill in the values (see below)
npx prisma db push          # create tables (uses DIRECT_URL)
npx prisma db seed          # teams, stadiums, all 104 matches — from static files in prisma/data
npm run dev
```

Run the engine tests (accrual formula, interest/FIFO, bet resolution, rep counter):

```bash
npm test
```

## Service setup

### Supabase (database + realtime)

1. Create a project → Project Settings → Database. Copy:
   - **pooled** connection string (port 6543, Supavisor) → `DATABASE_URL`, append `?pgbouncer=true&connection_limit=1`
   - **direct** connection string (port 5432) → `DIRECT_URL`
2. For the live leaderboard, enable Realtime on the ledger table (SQL editor):
   ```sql
   alter publication supabase_realtime add table "LedgerEntry";
   ```
   Project Settings → API → copy URL + anon key into
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Skip this entirely if you don't care — the leaderboard polls every 10s anyway.

### Clerk (auth)

Create an app at dashboard.clerk.com (enable Email + Google), copy the
publishable + secret keys into `.env`. Add `pentix.eu` as a production domain
when deploying.

### Cloudflare R2 (clips)

1. Create bucket `pentix-clips`, enable public access (r2.dev URL or a custom
   domain) → `R2_PUBLIC_BASE_URL`.
2. R2 → Manage API Tokens → create S3 credentials → `R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY`, plus account id → `R2_ACCOUNT_ID`.
3. Add a CORS policy on the bucket (uploads are browser → presigned PUT):
   ```json
   [
     {
       "AllowedOrigins": ["https://pentix.eu", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```
   If R2 isn't configured the app still works — sets are saved without video.

## Deploying to pentix.eu (Vercel)

1. Push the repo to GitHub and import it in Vercel (framework auto-detected;
   `postinstall` runs `prisma generate`).
2. Set every variable from `.env.example` in Vercel → Project → Environment
   Variables (`NEXT_PUBLIC_APP_URL=https://pentix.eu`, fresh `CRON_SECRET`).
3. Run the schema + seed against production once, from your machine:
   ```bash
   npx prisma db push && npx prisma db seed
   ```
4. Domains → add `pentix.eu` (apex). At your DNS provider add the A record
   Vercel shows (76.76.21.21) — or move nameservers to Vercel. Add `www` →
   redirect to apex if you want it.
5. The cron in `vercel.json` (`0 3 * * *` UTC → `/api/cron/interest`) is
   registered automatically; it authenticates with `CRON_SECRET`. Trigger it
   manually with:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://pentix.eu/api/cron/interest
   ```

## How the game works

- **Accrual** — a logged goal in a tracked match charges every member
  `baseReps × phaseMultiplier × teamMultiplier (+ flat bonuses) × handicap`,
  rounded to whole pushups. Hat-trick third goal doubles the raw part; late
  goals/penalty goals/favorite-player goals add flat bonuses (never
  phase-multiplied). Own goals charge the credited side but never trigger
  favorite-player or hat-trick.
- **Payments** — the RECORD flow counts reps via elbow-angle pose tracking
  (UP > 160°, DOWN < 95°, 400 ms debounce; tunable). You confirm the number,
  the clip uploads to R2 for the crew to audit, debt drops 1:1. A rep is a
  rep — handicap never touches payments.
- **Bets** — flat-stake challenges per match (winner take, loser pays in
  pushups); auto-resolved from the final score where possible.
- **Interest** — daily cron charges `outstanding × dailyRate` (rounded up),
  FIFO payment application, capped so lifetime interest never exceeds
  `principal × (capMultiplier − 1)`. FINISHED tournaments stop ticking.
- **Specials** — elimination penalty when the main country goes out; top-three
  placement bonus (collective suffering); penalty-shootout surcharge per miss.

All of it lives in pure, unit-tested modules under `src/lib/engine/` —
`accrual.ts`, `interest.ts`, `bets.ts`, `repCounter.ts`.

## WC2026 data

`prisma/data/` carries the open dataset from
[rezarahiminia/worldcup2026](https://github.com/rezarahiminia/worldcup2026)
(teams, stadiums, 72 group games) committed as static files — zero runtime API
dependency. The 32 knockout fixtures are seeded as TBD placeholders with the
official calendar (`prisma/knockout-template.ts`); admins assign teams as the
bracket fills. `prisma/data/team-patches.json` fills the six March-2026
playoff slots (Češka, BiH, Turska, Švedska, Irak, DR Kongo) and localizes all
team names to Croatian. Optional live-score *suggestions* (never auto-applied)
can be enabled by pointing `WC_API_BASE` at a hosted instance of that project.
