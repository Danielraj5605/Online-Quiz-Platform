# Quizzo v2 — Product & UX Design

Status: **proposal, awaiting approval** before backend work (Phase 2) begins.

## 1. Personas, roles, permissions

| Persona | Goal | Role enum |
|---|---|---|
| **Organizer** (teacher, trainer, HR) | Build quizzes, assign to cohorts, monitor live, grade, report | `ORGANIZER` |
| **Participant** (student, candidate) | Find/join quizzes, take them, review results, improve | `PARTICIPANT` |
| **Admin** | Moderate content, manage users/roles, audit, platform health | `ADMIN` |

Self-registration creates `PARTICIPANT`. A user can request Organizer status at signup (checkbox "I run quizzes"); this is granted immediately in v2 (no approval queue — see DECISIONS.md) and Admin can change it. Admin is seeded/promoted only by another Admin.

### Permissions matrix
✓ = allowed, own = only resources they own / are assigned to, — = denied

| Resource / action | Participant | Organizer | Admin |
|---|---|---|---|
| Browse public catalog, join by access code | ✓ | ✓ | ✓ |
| Take quiz (assigned/public/invited) | ✓ | ✓ (preview only on own) | — |
| View own attempts/results | own | own | ✓ |
| Create / edit / delete / archive quiz | — | own | ✓ |
| Publish, schedule, close quiz | — | own | ✓ |
| Question bank, tags, categories | read public | own CRUD | ✓ |
| Cohorts, invitations, access codes | — | own | ✓ |
| Live monitor | — | own quizzes | ✓ |
| Grade / re-grade / feedback | — | own quizzes | ✓ |
| Reports & exports | own results only | own quizzes | ✓ |
| Reviews/ratings of a quiz | after completing | — (not own) | moderate |
| Social (follow, badges, XP) | ✓ | ✓ | ✓ |
| Users & roles, moderation, audit log, platform analytics | — | — | ✓ |

Enforced server-side by a single `can(user, action, resource)` policy module; the UI only mirrors it for navigation.

## 2. Information architecture

### Participant (`/`)
- `/` Home — continue attempt, assigned & upcoming, streak/XP/badges, daily challenge
- `/discover` — public catalog (search, category, difficulty, tag filters), `/join` access-code entry
- `/quizzes/:id` — quiz overview (rules, duration, attempts left) → Start
- `/attempt/:attemptId` — **taking mode** (chrome-less)
- `/results/:attemptId` — score, band, review, time analysis, cohort comparison
- `/progress` — history + trends, `/leaderboard`, `/profile`

### Organizer (`/studio`)
- `/studio` Dashboard — live quizzes, **needs grading** count, recent activity, KPIs
- `/studio/quizzes` list (status tabs: Draft · Scheduled · Live · Closed · Archived)
- `/studio/quizzes/:id/build` — builder (Questions · Settings · Access · Preview tabs)
- `/studio/quizzes/:id/monitor` — live monitor
- `/studio/quizzes/:id/grading` — grading workspace
- `/studio/quizzes/:id/reports` — summary · item analysis · participants · cohorts · export
- `/studio/bank`, `/studio/cohorts`

### Admin (`/admin`)
- Overview analytics · Users & roles · Moderation queue · Audit log · Quizzes

Global: command palette (`⌘/Ctrl-K`) for jump-to and actions; theme toggle (light/dark/system); role-aware sidebar (desktop) / bottom tab bar (mobile).

## 3. Key flows

**Organizer:** create draft → add sections/questions (inline, drag to reorder, import from bank) → settings (time, attempts, shuffle, negative marking, pass mark, grade bands, answer-reveal policy, schedule, visibility) → *preview as participant* → publish (snapshots an immutable version; validation checklist blocks publish if incomplete) → invite (cohort / link / access code) → monitor live (in progress / submitted / time remaining) → grade subjective answers (queue, side-by-side answer + rubric, keyboard: `J/K` next/prev, `1–9` rubric levels, `Enter` save & next) → reports → export CSV/PDF. Editing a live quiz creates a new version; past attempts keep theirs.

**Participant:** discover or open assignment → overview → start (server starts the clock) → answer with autosave → flag/navigate → confirm-submit summary (answered / flagged / unanswered) → results (or "pending manual grading") → review with explanations *if organizer allows* → retake / progress.

## 4. Visual direction — "Marking Pen"

An exam-paper-meets-instrument-panel aesthetic: calm, serious, tactile — not purple-gradient SaaS.

- **Light:** warm paper (`#FAF7F2`) surfaces, ink text, hairline rules. **Dark:** deep ink (`#101215`), off-white text.
- **Accent:** one vermilion "marking pen" red-orange used sparingly (primary actions, active nav, correct/flag marks). Secondary: deep teal for informational/positive-neutral. Semantic success/warn/danger kept distinct from the accent.
- **Type:** *Fraunces* (display/headings, optical serif), *Instrument Sans* (UI/body), *JetBrains Mono* (timers, scores, numerals — tabular). Self-hosted via `@fontsource`, one load, `font-display: swap`.
- **Shape:** small radii (4–8px), 1px hairline borders, minimal shadows; elevation expressed by border + tone first, shadow second. Subtle paper grain only on marketing/auth surfaces.
- **Signature motion:** a "stamp" press on submit/grade-saved/pass (scale 1.08→1, 180ms), numeric tick-up on scores, progress rule that draws across the top in taking mode. All disabled under `prefers-reduced-motion` (replaced by instant state change).
- **Charts:** Recharts, series use the ink + accent + teal ramp, direct labels, hairline grid; follows the dataviz skill's palette validation.

### Design tokens (CSS variables, mapped via Tailwind v4 `@theme`)

```css
/* canonical copy lives in frontend/src/index.css; scripts/check-contrast.mjs verifies every pair */
:root {
  --bg:#FAF7F2; --surface:#FFFFFF; --surface-2:#F2EDE4; --border:#E2DACC; --border-strong:#857D6F; /* 3.7:1 for input borders */
  --text:#1B1A17; --text-muted:#5E5A50;
  --accent:#C8401F; --accent-hover:#A93417; --on-accent:#FFFFFF; --accent-soft:#FFF3EF;
  --teal:#0F6B67; --teal-soft:#DDEFEE; --success:#2F7D3B; --success-soft:#EDF6EE;
  --warning:#8F5400; --warning-soft:#F8EBD3; --danger:#B3261E; --danger-soft:#F9E1DF; --focus:#1F5FD1;
  /* type: Fraunces (display) / Instrument Sans (UI) / JetBrains Mono (numerals); radius 4/6/10/14; motion 120/200/360ms */
}
.dark {
  --bg:#101215; --surface:#171A1E; --surface-2:#1E2227; --border:#2B3037; --border-strong:#7B8390;
  --text:#EFEBE3; --text-muted:#A7A296;
  --accent:#FF7A55; --accent-hover:#FF9376; --on-accent:#1A0A05; --accent-soft:#3A1E15;
  --teal:#4FC3BC; --teal-soft:#12302E; --success:#6CC47A; --success-soft:#17301C;
  --warning:#E6A23C; --warning-soft:#36280F; --danger:#FF8A80; --danger-soft:#3A1C1A; --focus:#7FA8FF;
}
@media (prefers-reduced-motion: reduce) { /* all durations collapse to 0 */ }
```

Hex values were tuned during implementation (warning and soft tints darkened/lightened, `--border-strong` added for 3:1 input borders); `frontend/scripts/check-contrast.mjs` verifies every text/background pair (≥ 4.5:1 body, ≥ 3:1 large/UI) in both themes and fail CI if any regress. Theme: light / dark / system; no flash via inline script in `index.html`. The 5-theme system is dropped.

### Component library
shadcn/ui pattern on Radix primitives (Dialog, Popover, Dropdown, Tabs, Tooltip, Select, Checkbox, RadioGroup, Toast, Accordion), restyled to tokens, plus: DataTable (sort/filter/paginate, virtualised for big lists), StatCard, EmptyState, Skeleton, Stepper, Timer, QuestionNavigator, ScoreRing, StatusBadge (lifecycle states), RichText (sanitised), CommandPalette (cmdk), FormField (RHF + zod, `aria-describedby`/`aria-invalid` wired). Icons: lucide-react only (no emoji glyphs).

## 5. Accessibility — WCAG 2.2 AA
- **Quiz taking is fully keyboard-operable:** options are real `radio`/`checkbox` inputs in a `fieldset` with the question as `legend`; `←/→` or `P/N` prev/next, `F` flag, `1–9`/`A–Z` select option, `Ctrl+Enter` open submit summary; shortcuts listed in a `?` dialog and never fire inside text inputs.
- Focus: visible 2px `--focus` ring with 2px offset (3:1 vs adjacent), never `outline:none` alone; question change moves focus to the question heading; dialogs trap and restore focus (Radix); skip-to-content link; no focus obscured by sticky timer (scroll-padding).
- Timer: visually continuous, but `aria-live="polite"` announcements only at 50%, 10 min, 5 min, 1 min, 30 s (+ `role="timer"` with `aria-live="off"` for the ticking element). Autosave status is a polite live region.
- Target size ≥ 24×24 (44×44 on touch in taking mode); dragging in the builder always has a keyboard/button alternative (move up/down) — WCAG 2.5.7.
- Colour is never the only signal (correct/incorrect also use icon + text); charts have text/table alternatives.
- Reduced motion honoured; no content flashing; language attr and per-route `document.title`; forms announce errors in a summary + per-field.
- Verified with axe in Playwright on every route in both themes, plus a manual keyboard-only run-through of the full participant flow.

## 6. Responsive
Mobile-first breakpoints 360 / 640 / 1024 / 1440. Navigation: bottom tab bar < 1024, sidebar ≥ 1024.
**Quiz-taking on phones:** single-column; sticky top bar with timer + progress rule; large (≥ 48px) option cards; thumb-reach bottom bar with Prev / Flag / Next; question navigator as a bottom sheet (grid of numbered, state-coloured chips); `100dvh` layout and safe-area insets; autosave and offline queue so connectivity drops don't lose answers; no horizontal scroll at 360px.
Builder and grading workspace degrade to stacked panels on mobile (read/grade OK, heavy editing nudges to desktop); data tables become card lists.

## 7. Non-goals (v2)
Real-time multiplayer, proctoring/webcam, email delivery (verification & reset removed), payment.
