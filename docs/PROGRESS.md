# Progress

## Done
- [x] Branch `redesign/v2`; secrets git-ignored; committed `dist/` and `frontend/.env` untracked
- [x] Phase 0 audit; Phase 1 design (`DESIGN.md`) approved
- [x] **Backend**: Prisma schema + baseline migration (applied on Neon), roles, refresh-token rotation, policy layer, quizzes + versioning + lifecycle, bank, cohorts, taxonomy, catalog, attempt engine (server timer, autosave, resume, key never sent), grading engine (negative marking, partial credit, manual queue, regrade), results with reveal policy, reviews, gamification, organizer dashboard, reports (summary/items/participants/cohorts/CSV/PDF), admin + audit log, cache with tag invalidation + ETag, rate limits, seed
- [x] **Frontend**: design system ("Marking Pen", light/dark, contrast-checked), UI kit, role layouts, TanStack Query layer, auth pages; organizer (dashboard, quizzes, builder with dnd/undo/autosave, monitor, grading, reports, bank, cohorts); participant (home, discover, join, overview, taker, results, progress, leaderboard, profile); admin (overview, users, quizzes, moderation, audit)
- [x] README, `docker-compose.yml` + Dockerfiles, Playwright config, e2e spec
- [x] Checks passing offline: backend + frontend typecheck, lint (0 errors), frontend build, 90 frontend tests, 39 grading unit tests, contrast check (62 pairs)

## Not verified (database unreachable from the development network)
- [ ] Backend integration tests against Neon were passing when written by each workstream (quizzes 21, attempts 22, reports/admin 18) but were **not re-run** after the final changes
- [ ] `e2e/tests/full-flow.spec.ts` (organizer publishes → participant takes → organizer grades → reports) is written but **has not been run**; selectors may need small adjustments on first run
- [ ] Final browser pass over every page at 375/1280 px in light and dark: done per-stream earlier for most pages; grading shortcuts, bank form, cohort detail and desktop-dark were not re-checked
- [ ] Docker compose stack not built (Docker unavailable locally)
- [ ] Dedicated `/code-review` and security-review passes not run

## Known limitations
- Reports are computed in memory over bounded reads (≤ 50k results / 250k answers per quiz), cached 60 s
- No email delivery: no email verification or password reset (by decision); recovery is via Admin
- Participant report rows have no `latestAttemptId`; the UI looks it up via the monitor endpoint
- No `GET /cohorts/:id/quizzes`; the cohort page makes one request per quiz
- Live monitor uses 5 s polling (no SSE/WebSocket)
- Offline queue holds answers in localStorage per attempt; a lost device cannot resume
- `EXPIRED` attempt status is unused (expired attempts auto-submit)

## Suggested next steps
1. Run `npm test` and `npx playwright test` from a network that can reach the database; fix any selector drift
2. Run `/code-review` and `/security-review` on the branch
3. Rotate the Neon password (it was shared in chat) and set a strong `JWT_SECRET` for deployments
4. Add SQL aggregates for very large quizzes; consider SSE for the live monitor
