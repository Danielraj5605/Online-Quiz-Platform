# Quizzo — Online Quiz Platform (v2)

A role-based quiz platform: **Organizers** build, schedule, monitor, grade and report on quizzes; **Participants** discover, take, review and track progress; **Admins** moderate and manage the platform.

- **Web:** React 19 · Vite 7 · TypeScript · Tailwind v4 · TanStack Query · react-hook-form + zod · Radix
- **API:** Express 5 · TypeScript · Prisma 7 · PostgreSQL · Redis (optional, in-memory fallback)
- **Shared contract:** `shared/` (`@quiz/shared`) — zod schemas + DTO types used by both sides
- Design: [`docs/DESIGN.md`](docs/DESIGN.md) · API: [`docs/API.md`](docs/API.md) · Frontend conventions: [`docs/FRONTEND.md`](docs/FRONTEND.md) · Decisions: [`docs/DECISIONS.md`](docs/DECISIONS.md)

## Architecture

```
 Browser (React SPA) ──/api/v1──▶ Express API ─▶ routes → service → Prisma ─▶ PostgreSQL
        │  access token (memory)        │  ├─ core/auth      JWT access + rotating refresh (httpOnly cookie)
        │  refresh cookie (httpOnly)    │  ├─ core/policy    ownership & access checks (single place)
        │                               │  ├─ core/cache     Redis | in-memory, tag invalidation, ETag
        ▼                               │  └─ jobs           attempt-expiry sweeper, quiz lifecycle ticks
   TanStack Query cache                 ▼
                                   Redis (optional)
```

Key design points
- **Versioned quizzes:** publishing snapshots an immutable `QuizVersion`; attempts bind to a version, so editing a live quiz never corrupts past attempts. Re-grade across versions is explicit.
- **Server-authoritative attempts:** the server sets `expiresAt`, autosaves answers, resumes after disconnects, and never sends the answer key before submission. Results reveal the key only per the quiz's `showAnswers` policy.
- **Grading:** auto-grading (single/multi/true-false/short/numeric) with negative marking and partial credit; manual queue with rubrics for long answers.
- **Security:** helmet, strict CORS allow-list, route-class rate limits, zod on every input, HTML-stripping sanitiser, refresh-token rotation with reuse detection, role re-read from DB (not trusted from JWT), audit log on privileged actions.

## Quick start (local)

Prerequisites: Node 20+, a PostgreSQL database (e.g. Neon) — Redis optional.

```bash
npm install
cp backend/.env.example backend/.env        # set DATABASE_URL (and JWT_SECRET for production)
npm run db:migrate                           # applies prisma migrations
npm run db:seed                              # ⚠ wipes app tables, loads demo data
npm run dev:api                              # http://localhost:5000
npm run dev:web                              # http://localhost:5173 (proxies /api)
```

### Docker
```bash
docker compose up --build        # web :8080, api :5000, postgres :5432, redis :6379
docker compose exec api npx tsx prisma/seed.ts   # optional demo data
```

## Environment variables (`backend/.env`)

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | prod | ≥ 32 chars. In dev an ephemeral secret is generated (sessions reset on restart) |
| `REDIS_URL` | no | Shared cache; in-memory fallback if unset |
| `CORS_ORIGINS` | prod | Comma-separated allowed origins (default `http://localhost:5173`) |
| `TRUST_PROXY` | no | `true` behind a reverse proxy |
| `PORT`, `NODE_ENV` | no | default `5000`, `development` |

The frontend needs no env vars in dev (Vite proxies `/api`). To point at another API set `VITE_API_URL`.

## Scripts (repo root)

| Script | Does |
|---|---|
| `npm run dev:api` / `dev:web` | start API / web in watch mode |
| `npm run build` | build API (tsup) and web (Vite) |
| `npm run typecheck` · `npm run lint` | across both apps |
| `npm test` | Vitest — API unit + integration (needs `DATABASE_URL`), web component tests |
| `npm run e2e` | Playwright end-to-end (starts both servers) |
| `npm run db:migrate` · `db:seed` | Prisma migrate · demo seed |

## Demo accounts (after `npm run db:seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@quizzo.dev` | `Admin#12345` |
| Organizer | `organizer@quizzo.dev`, `ola@quizzo.dev` | `Organizer#12345` |
| Participant | `participant@quizzo.dev`, `learner01..24@quizzo.dev` | `Participant#12345` |

Quiz access code for the private Algebra quiz: `ALGEBRA24`.

## Repository layout
```
backend/   Express API (src/core, src/modules/*, prisma/, tests/)
frontend/  React app (src/app, src/components, src/features/{auth,participant,organizer,admin}, src/lib)
shared/    @quiz/shared — contract (schemas, DTO types)
e2e/       Playwright tests + visual QA helpers
docs/      DESIGN · API · FRONTEND · DECISIONS · PROGRESS
```

## Known limitations
See [`docs/PROGRESS.md`](docs/PROGRESS.md#known-limitations).
