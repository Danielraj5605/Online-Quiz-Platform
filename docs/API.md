# API contract (v1)

Base: `/api/v1`. JSON. Success `{ data, meta? }`, failure `{ error: { code, message, details? } }`.
Types/zod schemas live in `shared/src/index.ts` (`@quiz/shared`) — **that file is the source of truth for DTO shapes**.
Auth: `Authorization: Bearer <accessToken>` (15 min). Refresh token is an httpOnly cookie `rt` (path `/api/v1/auth`), rotated on every `/auth/refresh`.
List endpoints accept `page, pageSize, sort (field | -field), q` and return `meta: PageMeta`.
Roles: A=Admin, O=Organizer, P=Participant. "own" = resource owner (Admin always passes).

## Auth & users
| Method Path | Who | Notes |
|---|---|---|
| POST /auth/register | public | `registerSchema` → `AuthResult` + sets cookie |
| POST /auth/login | public | `loginSchema` → `AuthResult` + cookie |
| POST /auth/refresh | cookie | rotates; reuse of a revoked token revokes the family → 401 |
| POST /auth/logout | any | revokes family, clears cookie |
| GET /auth/me | any | `UserDto` |
| PATCH /users/me | any | `updateProfileSchema` |
| PUT /users/me/password | any | `changePasswordSchema`; revokes all refresh tokens |
| GET /users/:id/public | any | username, name, avatar, xp, tier, badges, follower counts |
| POST/DELETE /users/:id/follow | any | |

## Taxonomy
GET /categories (any) · POST /categories (O,A) · GET /tags?q= (any)

## Quizzes (organizer studio)
| Method Path | Who | Notes |
|---|---|---|
| GET /quizzes | O own / A all | filters `status, mine, categoryId`; → `QuizSummaryDto[]` (soft-deleted excluded) |
| POST /quizzes | O,A | `createQuizSchema` → `QuizDetailDto` (DRAFT) |
| GET /quizzes/:id | own | `QuizDetailDto` incl. key |
| PATCH /quizzes/:id | own | `updateQuizSchema`; sets `dirty` if live |
| DELETE /quizzes/:id | own | soft delete (blocked while attempts IN_PROGRESS) |
| POST /quizzes/:id/duplicate | own | copy as DRAFT |
| POST /quizzes/:id/publish | own | validates (≥1 question, valid questions); snapshots `QuizVersion`; status → LIVE or SCHEDULED (`opensAt` in future); clears `dirty` |
| POST /quizzes/:id/close | own | → CLOSED; in-progress attempts keep their deadline |
| POST /quizzes/:id/archive | own | → ARCHIVED |
| POST /quizzes/:id/reopen | own | CLOSED/ARCHIVED → LIVE/DRAFT |
| GET /quizzes/:id/versions | own | `[{id, number, createdAt, attemptCount}]` |
| POST /quizzes/:id/regrade | own | body `{versionId?}` re-grades submitted attempts (auto parts only, manual scores kept) against the version (default current) |
| POST /quizzes/:id/sections · PATCH/DELETE /sections/:id | own | |
| POST /quizzes/:id/questions · PATCH/DELETE /questions/:id | own | `questionInputSchema` |
| POST /quizzes/:id/reorder | own | `reorderSchema` |
| POST /quizzes/:id/import-bank | own | `{bankIds, sectionId?}` |
| PUT/GET /quizzes/:id/access | own | `accessSchema`; returns `{visibility, accessCode, cohorts, users}` |
| GET /bank · POST /bank · PATCH/DELETE /bank/:id | O own, A all | `bankQuestionSchema` |
| GET/POST /cohorts · GET/PATCH/DELETE /cohorts/:id | O own | |
| POST /cohorts/:id/members (`cohortMembersSchema`) · DELETE /cohorts/:id/members/:userId | O own | |

## Participant discovery
| GET /catalog | any | PUBLIC + LIVE only; filters `q, categoryId, difficulty, tag` → `QuizOverviewDto[]` |
| GET /catalog/:id | any w/ access | overview (access = public, or code-joined, or invited, or cohort-assigned, or owner/admin) |
| POST /catalog/join | any | `{code}` → `QuizOverviewDto` (records an Invitation so it appears in assignments) |
| GET /me/assignments | P | `{inProgress: QuizOverviewDto[], assigned: [], upcoming: []}` |

## Attempts
| POST /quizzes/:id/attempts | any with access | start or resume the ACTIVE attempt → `AttemptViewDto`. Enforces LIVE, window, maxAttempts. Never returns key. Server sets `expiresAt`. Owners may start a *preview* (query `?preview=1`, not persisted in reports: attempt number 0, excluded from stats) |
| GET /attempts/:id | owner of attempt | `AttemptViewDto` (resume) — if expired & not submitted, auto-submits first |
| PUT /attempts/:id/answers | owner | `saveAnswersSchema`; idempotent; rejected (409) after `expiresAt + 5s` |
| POST /attempts/:id/events | owner | `attemptEventSchema` (tab switches / away seconds) |
| POST /attempts/:id/submit | owner | grades; returns `ResultDto`. Idempotent. Server computes duration |
| GET /attempts/:id/result | owner / quiz owner / A | `ResultDto`; key fields only if `showAnswers` policy allows (see §Rules) |
| GET /me/attempts | any | history `[{attemptId, quizId, quizTitle, number, status, percentage, passed, band, submittedAt}]` |
| GET /me/progress | any | `{trend:[{date, pct}], byCategory:[...], totals}` |
| GET /quizzes/:id/leaderboard | any with access | top 20 best attempt per user (cached) |
| GET /leaderboard | any | global XP leaderboard |
| GET/POST/DELETE /quizzes/:id/reviews | any who completed (not owner) | `reviewSchema`; GET returns list + aggregate |
| GET /me/gamification | any | `{xp, tier, nextTier, streakDays, badges[]}` |
| GET /daily-challenge | any | today's challenge quiz overview |

## Organizer operations
| GET /organizer/dashboard | O,A | `{kpis:{liveQuizzes, participants, avgScorePct, needsGrading}, liveQuizzes[], needsGrading:[{quizId,title,count}], recentActivity[]}` |
| GET /quizzes/:id/monitor | own | `{participants:[{userId, username, status, startedAt, expiresAt, answered, total, tabSwitches, lastSeenAt}], counts:{inProgress, submitted, notStarted}}` (poll every 5s) |
| GET /quizzes/:id/grading/submissions | own | `?status=pending|graded|all` attempts with pending manual items |
| GET /attempts/:id/grading | quiz owner | full attempt incl. key, rubric, per-answer grade |
| PUT /attempts/:id/grading | quiz owner | `gradeAnswersSchema`; when no `needsManual` left → attempt GRADED, `Result.isFinal` |
| POST /quizzes/:id/grading/bulk | quiz owner | `bulkGradeSchema` |

## Reports (quiz owner / Admin)
GET /quizzes/:id/reports/summary → `{attempts, participants, avgPct, medianPct, passRate, avgDurationSec, distribution:[{bucket,count}], bands:[{label,count}], gradedPending}`
GET /quizzes/:id/reports/items → per question `{questionId,text,type,difficulty(p-value),discrimination,avgTimeMs,omitRate,distractors:[{optionId,text,count,isCorrect}]}`
GET /quizzes/:id/reports/participants → `[{userId,username,attempts,bestPct,lastPct,passed,avgDurationSec}]` (paged)
GET /quizzes/:id/reports/cohorts → `[{cohortId,name,members,attempted,avgPct,passRate}]`
GET /quizzes/:id/reports/export.csv · export.pdf → file download

## Admin
GET /admin/users · PATCH /admin/users/:id (`adminUpdateUserSchema`) · GET /admin/analytics · GET /admin/quizzes · PATCH /admin/quizzes/:id (`{isFlagged?, status?}`) · GET /admin/moderation · PATCH /admin/moderation/:id (`{action:'DISMISS'|'REMOVE'}`) · GET /admin/audit-log (filters `action, actorId, from, to`)
POST /reports (any) — `flagSchema` creates a FlaggedContent

## Rules (server-enforced)
- **Answer key never leaves the server** except to the quiz owner/Admin, and to a participant's own result when `settings.showAnswers` is `AFTER_SUBMIT`, or `AFTER_CLOSE` and quiz is CLOSED/ARCHIVED (and attempt is not IN_PROGRESS). `NEVER` → no key, no explanation.
- Attempt clock: `expiresAt = min(startedAt + timeLimit, quiz.closesAt)`; sweeper auto-submits expired attempts (every 30 s + lazily on read).
- Max attempts counts SUBMITTED/GRADED/EXPIRED attempts of the user for the quiz (preview attempts excluded).
- Scoring: MCQ_SINGLE/TRUE_FALSE all-or-nothing; MCQ_MULTI all-or-nothing or proportional (`correctSelected/correctTotal − wrongSelected/correctTotal`, floor 0); SHORT_ANSWER match against `acceptedAnswers` (trim, case per config); NUMERIC within `tolerance`; LONG_ANSWER manual. Wrong objective answer deducts `negativeMarking × points` (unanswered = 0). Question score floored at `-points×negativeMarking`; total floored at 0.
- XP/badges awarded only on the first FINAL result per quiz per user.
- Every mutating admin/organizer action writes an `AuditLog`.
- Rate-limit classes: auth (10/15min), attempts-write (120/min), writes (60/min), reads (300/min).
