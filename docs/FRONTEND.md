# Frontend conventions

Stack: React 19 · Vite 7 · TypeScript (strict) · Tailwind v4 · TanStack Query · react-hook-form + zod (`@quiz/shared`) · Radix primitives · react-router 7.
Path alias `@` → `frontend/src`. Dev server `:5173` proxies `/api` → `:5000`.

## Layout

```
src/
  app/            router.tsx · auth.tsx (AuthProvider/useAuth/homeFor) · theme.tsx · guards.tsx · nav.ts · lazy.ts
  components/
    ui/           design-system primitives (import from '@/components/ui' barrel or the file)
    layout/       shell.tsx (AppShell, ParticipantLayout, StudioLayout, AdminLayout, TakingLayout, RoleAwareLayout, Brand)
                  error-boundary.tsx · offline-banner.tsx · placeholder.tsx
  lib/
    api/          client.ts (fetch + refresh) · types.ts · one module per entity group · index.ts barrel
    query/        client.ts (QueryClient + global error toast) · keys.ts (key factories) · hooks.ts
    hooks/        useDocumentTitle · useOnline · useDebounced · useMediaQuery
    utils.ts      cn · fmtDate · fmtPct · fmtDuration · initials
  features/
    auth/         Login · Register · StatusPages (NotFound, Forbidden)           ← done
    participant/  routes.tsx + pages/*.tsx
    organizer/    routes.tsx + pages/*.tsx
    admin/        routes.tsx + pages/*.tsx
```

### Ownership rule (so parallel work never conflicts)
Each feature owns **only** `src/features/<feature>/**`. Replace the placeholder page files in `pages/` (keep `export default`, keep file names, or add files and update that feature's `routes.tsx`). Put feature-only components in `src/features/<feature>/components/`. If you need a new shared primitive, add a **new file** under `components/ui/` and append one line to `components/ui/index.ts`. Add API response types by **appending** to `lib/api/types.ts` and new endpoints to the matching `lib/api/<group>.ts`; add new query keys by appending to `lib/query/keys.ts`.

## Adding a page
1. Create `features/<feature>/pages/Foo.tsx` with `export default function Foo()`; call `useDocumentTitle('Foo')`; wrap content in `<PageHeader title=… />`.
2. Register in the feature's `routes.tsx`: `{ path: '/studio/foo', ...page(() => import('./pages/Foo')) }` (lazy / code-split).
3. Add to `app/nav.ts` if it should appear in navigation (and it will show up in the command palette automatically).

## Data fetching
```tsx
const { data, isPending } = useApiQuery(keys.quizzes.detail(id), () => quizzesApi.get(id));
const list = usePagedQuery(keys.quizzes.list(q), () => quizzesApi.list(q));      // data.data + data.meta
const save = useApiMutation((v: Patch) => quizzesApi.update(id, v), {
  invalidate: [keys.quizzes.detail(id), keys.quizzes.all], success: 'Saved',
  // optimistic: { key: keys.quizzes.detail(id), update: (old, v) => ({ ...(old as object), ...v }) },
});
```
Errors toast globally (401 handled by the client; pass `silent: true` to suppress). Field errors from the API: `err.fieldErrors` → `setError`.
Auth: access token in memory only; refresh cookie is httpOnly; `useAuth()` gives `{ user, loading, login, register, logout, hasRole }`.

## Forms
`useForm<z.input<typeof schema>, unknown, Output>({ resolver: zodResolver(schema) })` with schemas from `@quiz/shared`; wrap controls in `<FormField label error hint required>` (injects id / aria-invalid / aria-describedby).

## UI primitives (`components/ui`)
Button (+`buttonVariants`, `asChild`, `loading`) · Input · Textarea · Label · FormField · Select (`SelectTrigger/Content/Item`) · Checkbox · RadioGroup(+Item) · Switch · Tabs (`TabsList/Trigger/Content`) · Dialog (+Title/Description/Footer/Close) · ConfirmDialog · DropdownMenu (+Item/Label/Separator) · Popover · Tooltip(+Provider) · Badge · StatusBadge (`kind="quiz"|"attempt"`) · Card (+Header/Title/Description/Content/Footer) · Skeleton · SkeletonGroup · EmptyState · PageHeader · StatCard · Avatar · Progress · VisuallyHidden · SkipLink · Spinner · PageSpinner · Toaster (use `toast` from `sonner`) · DataTable (`Column<T>`, server sort/pagination, mobile card mode) · Pagination · ScoreRing · Timer (server-corrected countdown, a11y announcements) · Stepper · CommandPalette (accepts `extra` actions) · ThemeToggle.

## Styling
Use token utilities only — `bg-bg bg-surface bg-surface-2 border-border border-border-strong text-text text-muted bg-accent text-on-accent bg-accent-soft text-teal text-success text-warning text-danger` (+ `-soft`), `font-display` (headings) / `font-sans` / `font-mono` (use `.num` for numerals/timers/scores). Never hard-code hex. Radius via `rounded-sm|md|lg`. Respect `prefers-reduced-motion` (global rule collapses durations; don't add JS animation without checking). Min touch target 44px on mobile in taking mode; 24px elsewhere. `npm run check:contrast` must stay green when you touch tokens.

## Checks
`npm run typecheck && npm run lint && npm run test && npm run build && npm run check:contrast` (in `frontend/`). Visual QA: `node e2e/screenshots.mjs <baseUrl> <outDir> /path1,/path2` (set `MSYS_NO_PATHCONV=1` on Git Bash) captures 375px/1280px × light/dark.
