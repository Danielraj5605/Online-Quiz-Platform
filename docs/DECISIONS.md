# Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Fresh baseline migration on Neon (old DB had no migration history) | User choice; old schema had a unique key that made attempt history impossible |
| 2 | Dropped email verification and email-based password reset | User choice; no mailer existed (links were only logged). Password change requires the current password and revokes all sessions |
| 3 | Two themes (light/dark/system) instead of five | One coherent, contrast-verified system beats five loosely maintained palettes |
| 4 | Self-signup can choose Organizer, no approval queue | Frictionless onboarding; Admin can change roles |
| 5 | Short-lived access token in memory + rotating refresh token in httpOnly cookie, reuse detection revokes the family | Removes localStorage token exposure; enables revocation |
| 6 | Role is re-read from the DB (30 s cache, tag-invalidated) on each request, not trusted from the JWT | Demotion/disable takes effect immediately |
| 7 | Stable Vite 7 instead of the Vite 8 beta override | Production builds should not depend on a beta |
| 8 | Quiz versions are JSON snapshots (`QuizVersion.snapshot`) rather than row copies | Immutable, cheap, and grading never depends on mutable draft rows |
| 9 | Attempts: many per user/quiz (`@@unique([quizId,userId,number])`); preview attempts use number 0 and are excluded from stats | Fixes old design where a retake deleted history |
| 10 | Owners/admins cannot take their own quiz (preview only) | Keeps stats and leaderboards honest |
| 11 | `EXPIRED` status is unused: auto-submitted attempts become SUBMITTED/GRADED | Expiry is just a submit reason; avoids a dead-end state |
| 12 | Removed "share result" endpoint (old IDOR) rather than re-implementing | Results are visible to the taker, quiz owner and Admin only |
| 13 | Reports are computed in memory over bounded reads (≤50k results / 250k answers per quiz) with 60 s cache | Simple and fast at expected scale; revisit with SQL aggregates/materialised views if quizzes grow far beyond this |
| 14 | `bcryptjs` instead of native `bcrypt` | No native build step on Windows/Alpine |
| 15 | Backend built with `tsup` (bundles `@quiz/shared`) | Shared TS package consumed as source without a separate build step |
| 16 | Layering is routes → service (→ repository where queries are non-trivial) rather than a separate controller file per module | Controllers would be one-line pass-throughs; routes parse/validate and call services |
| 17 | The `frontend-design` skill was not installed in this environment; design guidance came from DESIGN.md plus the dataviz/artifact-design skills | Transparency |
