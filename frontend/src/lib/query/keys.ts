/**
 * Query key factories — one place, keyed by entity so invalidation is predictable:
 *   qc.invalidateQueries({ queryKey: keys.quizzes.all })  // everything about quizzes
 *   qc.invalidateQueries({ queryKey: keys.quizzes.detail(id) })
 */
export const keys = {
  me: ['me'] as const,
  quizzes: {
    all: ['quizzes'] as const,
    list: (q: object = {}) => ['quizzes', 'list', q] as const,
    detail: (id: string) => ['quizzes', 'detail', id] as const,
    versions: (id: string) => ['quizzes', 'versions', id] as const,
    access: (id: string) => ['quizzes', 'access', id] as const,
    categories: ['quizzes', 'categories'] as const,
    tags: (q?: string) => ['quizzes', 'tags', q ?? ''] as const,
  },
  bank: { all: ['bank'] as const, list: (q: object = {}) => ['bank', 'list', q] as const },
  cohorts: {
    all: ['cohorts'] as const,
    list: (q: object = {}) => ['cohorts', 'list', q] as const,
    detail: (id: string) => ['cohorts', 'detail', id] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    list: (q: object = {}) => ['catalog', 'list', q] as const,
    detail: (id: string) => ['catalog', 'detail', id] as const,
    assignments: ['catalog', 'assignments'] as const,
    daily: ['catalog', 'daily'] as const,
  },
  attempts: {
    all: ['attempts'] as const,
    detail: (id: string) => ['attempts', 'detail', id] as const,
    result: (id: string) => ['attempts', 'result', id] as const,
    history: (q: object = {}) => ['attempts', 'history', q] as const,
    progress: ['attempts', 'progress'] as const,
    leaderboard: (quizId: string) => ['attempts', 'leaderboard', quizId] as const,
    globalLeaderboard: ['attempts', 'leaderboard', 'global'] as const,
  },
  grading: {
    all: ['grading'] as const,
    submissions: (quizId: string, q: object = {}) => ['grading', 'submissions', quizId, q] as const,
    attempt: (attemptId: string) => ['grading', 'attempt', attemptId] as const,
    monitor: (quizId: string) => ['grading', 'monitor', quizId] as const,
  },
  reports: {
    all: ['reports'] as const,
    summary: (quizId: string) => ['reports', 'summary', quizId] as const,
    items: (quizId: string) => ['reports', 'items', quizId] as const,
    participants: (quizId: string, q: object = {}) => ['reports', 'participants', quizId, q] as const,
    cohorts: (quizId: string) => ['reports', 'cohorts', quizId] as const,
  },
  organizer: { dashboard: ['organizer', 'dashboard'] as const },
  gamification: { me: ['gamification', 'me'] as const },
  reviews: { list: (quizId: string) => ['reviews', quizId] as const },
  users: { public: (id: string) => ['users', 'public', id] as const },
  admin: {
    all: ['admin'] as const,
    users: (q: object = {}) => ['admin', 'users', q] as const,
    analytics: ['admin', 'analytics'] as const,
    quizzes: (q: object = {}) => ['admin', 'quizzes', q] as const,
    moderation: (q: object = {}) => ['admin', 'moderation', q] as const,
    audit: (q: object = {}) => ['admin', 'audit', q] as const,
  },
};
