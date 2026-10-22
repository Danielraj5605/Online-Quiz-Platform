/**
 * @quiz/shared — the contract between API and web.
 * Enums, zod schemas (used for validation on both sides) and DTO types.
 */
import { z } from 'zod';

/* ───────────── enums ───────────── */
export const ROLES = ['ADMIN', 'ORGANIZER', 'PARTICIPANT'] as const;
export const QUIZ_STATUSES = ['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED', 'ARCHIVED'] as const;
export const VISIBILITIES = ['PUBLIC', 'UNLISTED', 'PRIVATE'] as const;
export const QUESTION_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'NUMERIC', 'LONG_ANSWER'] as const;
export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'GRADED', 'EXPIRED'] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const SHOW_ANSWERS = ['NEVER', 'AFTER_SUBMIT', 'AFTER_CLOSE'] as const;

export type Role = (typeof ROLES)[number];
export type QuizStatus = (typeof QUIZ_STATUSES)[number];
export type Visibility = (typeof VISIBILITIES)[number];
export type QuestionType = (typeof QUESTION_TYPES)[number];
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type ShowAnswers = (typeof SHOW_ANSWERS)[number];

export const OBJECTIVE_TYPES: QuestionType[] = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT_ANSWER', 'NUMERIC'];
export const hasOptions = (t: QuestionType) => t === 'MCQ_SINGLE' || t === 'MCQ_MULTI' || t === 'TRUE_FALSE';

/* ───────────── envelope / pagination ───────────── */
export interface PageMeta { page: number; pageSize: number; total: number; totalPages: number }
export interface ApiOk<T> { data: T; meta?: PageMeta }
export interface ApiErr { error: { code: string; message: string; details?: unknown } }

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(40).optional(), // "field" or "-field"
  q: z.string().max(100).optional(),
});
export type PageQuery = z.infer<typeof pageQuery>;

/* ───────────── auth / users ───────────── */
const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72)
  .regex(/[a-z]/, 'Needs a lowercase letter')
  .regex(/[A-Z]/, 'Needs an uppercase letter')
  .regex(/\d/, 'Needs a digit');

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, numbers, _ . - only'),
  email: z.string().trim().toLowerCase().email().max(120),
  password: passwordRule,
  name: z.string().trim().max(80).optional(),
  role: z.enum(['PARTICIPANT', 'ORGANIZER']).default('PARTICIPANT'),
});
export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(120), // email or username
  password: z.string().min(1).max(72),
});
export const updateProfileSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  name: z.string().trim().max(80).optional(),
  avatarUrl: z.string().url().max(300).nullable().optional(),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordRule,
});
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface UserDto {
  id: string; username: string; email: string; name: string | null; avatarUrl: string | null;
  role: Role; xp: number; tier: string; streakDays: number; createdAt: string;
}
export interface AuthResult { user: UserDto; accessToken: string }

/* ───────────── quiz settings ───────────── */
export const gradeBandSchema = z.object({ label: z.string().min(1).max(20), minPct: z.number().min(0).max(100) });
export const quizSettingsSchema = z.object({
  /** null = untimed */
  timeLimitSec: z.number().int().min(30).max(60 * 60 * 8).nullable().default(null),
  maxAttempts: z.number().int().min(1).max(50).default(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  /** fraction of question points deducted for a wrong objective answer, 0..1 */
  negativeMarking: z.number().min(0).max(1).default(0),
  passMarkPct: z.number().min(0).max(100).default(50),
  gradeBands: z.array(gradeBandSchema).max(10).default([
    { label: 'A', minPct: 90 }, { label: 'B', minPct: 75 }, { label: 'C', minPct: 60 }, { label: 'D', minPct: 50 }, { label: 'F', minPct: 0 },
  ]),
  showAnswers: z.enum(SHOW_ANSWERS).default('AFTER_SUBMIT'),
  showExplanations: z.boolean().default(true),
});
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export const defaultQuizSettings = (): QuizSettings => quizSettingsSchema.parse({});

/* ───────────── questions ───────────── */
export const rubricItemSchema = z.object({ criterion: z.string().min(1).max(200), maxPoints: z.number().min(0).max(100) });
export const questionConfigSchema = z.object({
  /** MCQ_MULTI: 'none' = all-or-nothing, 'proportional' = partial credit */
  partialCredit: z.enum(['none', 'proportional']).default('none'),
  /** SHORT_ANSWER */
  acceptedAnswers: z.array(z.string().max(200)).max(20).default([]),
  caseSensitive: z.boolean().default(false),
  /** NUMERIC */
  numericAnswer: z.number().nullable().default(null),
  tolerance: z.number().min(0).default(0),
  /** LONG_ANSWER */
  rubric: z.array(rubricItemSchema).max(10).default([]),
  maxLength: z.number().int().min(1).max(20000).default(5000),
});
export type QuestionConfig = z.infer<typeof questionConfigSchema>;

export const optionInputSchema = z.object({ text: z.string().trim().min(1).max(500), isCorrect: z.boolean() });
export const questionInputSchema = z
  .object({
    type: z.enum(QUESTION_TYPES),
    text: z.string().trim().min(1).max(4000),
    explanation: z.string().trim().max(4000).default(''),
    points: z.number().min(0).max(1000).default(1),
    sectionId: z.string().nullable().optional(),
    options: z.array(optionInputSchema).max(10).default([]),
    config: questionConfigSchema.default(() => questionConfigSchema.parse({})),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length;
    if (q.type === 'MCQ_SINGLE' && (q.options.length < 2 || correct !== 1))
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Single choice needs ≥2 options and exactly 1 correct' });
    if (q.type === 'MCQ_MULTI' && (q.options.length < 2 || correct < 1))
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Multiple choice needs ≥2 options and ≥1 correct' });
    if (q.type === 'TRUE_FALSE' && (q.options.length !== 2 || correct !== 1))
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'True/False needs exactly 2 options, 1 correct' });
    if (q.type === 'SHORT_ANSWER' && q.config.acceptedAnswers.length < 1)
      ctx.addIssue({ code: 'custom', path: ['config', 'acceptedAnswers'], message: 'Add at least one accepted answer' });
    if (q.type === 'NUMERIC' && q.config.numericAnswer === null)
      ctx.addIssue({ code: 'custom', path: ['config', 'numericAnswer'], message: 'Numeric answer required' });
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/* ───────────── answers ───────────── */
export const answerValueSchema = z.object({
  optionIds: z.array(z.string()).max(10).optional(),
  text: z.string().max(20000).optional(),
  number: z.number().finite().optional(),
});
export type AnswerValue = z.infer<typeof answerValueSchema>;
export const saveAnswersSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    value: answerValueSchema,
    flagged: z.boolean().optional(),
    timeSpentMs: z.number().int().min(0).max(1000 * 60 * 60 * 8).optional(),
  })).min(1).max(200),
});
export const attemptEventSchema = z.object({
  type: z.enum(['blur', 'focus', 'hidden', 'visible']),
  /** seconds spent away, sent on 'focus'/'visible' */
  awaySec: z.number().int().min(0).max(86400).optional(),
});

/* ───────────── quiz DTOs ───────────── */
export const createQuizSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(5000).default(''),
  categoryId: z.string().nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).default('MEDIUM'),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  settings: quizSettingsSchema.default(() => defaultQuizSettings()),
  opensAt: z.string().datetime().nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
});
export const updateQuizSchema = createQuizSchema.partial();
export const accessSchema = z.object({
  visibility: z.enum(VISIBILITIES).optional(),
  regenerateCode: z.boolean().optional(),
  cohortIds: z.array(z.string()).optional(),
  userIds: z.array(z.string()).optional(),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

/** A question as an organizer sees it (includes answer key). */
export interface QuestionAuthorDto {
  id: string; type: QuestionType; text: string; explanation: string; points: number; position: number;
  sectionId: string | null; config: QuestionConfig; options: { id: string; text: string; isCorrect: boolean; position: number }[];
}
export interface SectionDto { id: string; title: string; description: string; position: number }
export interface QuizSummaryDto {
  id: string; title: string; description: string; status: QuizStatus; visibility: Visibility; difficulty: Difficulty;
  category: { id: string; name: string } | null; tags: string[]; owner: { id: string; username: string; name: string | null };
  opensAt: string | null; closesAt: string | null; questionCount: number; totalPoints: number;
  attemptCount: number; avgRating: number | null; ratingCount: number; dirty: boolean; currentVersion: number | null;
  settings: QuizSettings; createdAt: string; updatedAt: string;
}
export interface QuizDetailDto extends QuizSummaryDto {
  accessCode: string | null; sections: SectionDto[]; questions: QuestionAuthorDto[];
}

/** Catalog/overview for participants (no answer key). */
export interface QuizOverviewDto {
  id: string; title: string; description: string; difficulty: Difficulty; category: string | null; tags: string[];
  owner: { username: string; name: string | null }; status: QuizStatus; opensAt: string | null; closesAt: string | null;
  questionCount: number; totalPoints: number; timeLimitSec: number | null; maxAttempts: number; attemptsUsed: number;
  passMarkPct: number; avgRating: number | null; ratingCount: number; activeAttemptId: string | null; canStart: boolean; reason?: string;
}

/* ───────────── attempt (participant view; never contains the key) ───────────── */
export interface AttemptQuestionDto {
  id: string; type: QuestionType; text: string; points: number; sectionTitle: string | null;
  options: { id: string; text: string }[]; maxLength?: number;
}
export interface AttemptViewDto {
  id: string; quizId: string; quizTitle: string; status: AttemptStatus; startedAt: string; expiresAt: string | null;
  /** server clock at response time so the client can correct drift */
  serverNow: string; questions: AttemptQuestionDto[];
  answers: Record<string, { value: AnswerValue; flagged: boolean }>;
}

/* ───────────── results ───────────── */
export interface ResultQuestionReview {
  questionId: string; text: string; type: QuestionType; points: number; score: number | null; isCorrect: boolean | null;
  needsManual: boolean; yourAnswer: AnswerValue | null; timeSpentMs: number; feedback: string;
  /** present only if quiz.showAnswers allows */
  correct?: { optionIds?: string[]; acceptedAnswers?: string[]; numericAnswer?: number | null };
  explanation?: string;
  options: { id: string; text: string }[];
}
export interface ResultDto {
  attemptId: string; quizId: string; quizTitle: string; status: AttemptStatus; isFinal: boolean;
  score: number; maxScore: number; percentage: number; band: string | null; passed: boolean; durationSec: number | null;
  submittedAt: string | null; cohortAvgPct: number | null; percentile: number | null; answersRevealed: boolean;
  review: ResultQuestionReview[];
}

/* ───────────── grading ───────────── */
export const gradeAnswersSchema = z.object({
  grades: z.array(z.object({
    answerId: z.string(),
    score: z.number().min(0),
    feedback: z.string().max(4000).default(''),
    rubricScores: z.array(z.number().min(0)).optional(),
  })).min(1).max(200),
});
export const bulkGradeSchema = z.object({
  answerIds: z.array(z.string()).min(1).max(500),
  scorePct: z.number().min(0).max(100),
  feedback: z.string().max(4000).default(''),
});

/* ───────────── misc ───────────── */
export const cohortSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().max(500).default('') });
export const cohortMembersSchema = z.object({ identifiers: z.array(z.string().trim().min(1)).min(1).max(500) }); // usernames or emails
export const reviewSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).default('') });
export const flagSchema = z.object({ entityType: z.enum(['QUIZ', 'REVIEW', 'USER']), entityId: z.string(), reason: z.string().trim().min(3).max(500) });
export const bankQuestionSchema = z.object({
  type: z.enum(QUESTION_TYPES), text: z.string().trim().min(1).max(4000), explanation: z.string().max(4000).default(''),
  points: z.number().min(0).max(1000).default(1), tags: z.array(z.string().max(30)).max(10).default([]),
  categoryId: z.string().nullable().optional(), options: z.array(optionInputSchema).max(10).default([]),
  config: questionConfigSchema.default(() => questionConfigSchema.parse({})),
});
export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sectionId: z.string().nullable(), position: z.number().int().min(0) })).min(1).max(1000),
  sections: z.array(z.object({ id: z.string(), position: z.number().int().min(0) })).optional(),
});
export const adminUpdateUserSchema = z.object({ role: z.enum(ROLES).optional(), disabled: z.boolean().optional() });

/** Tier thresholds shared so UI can show progress. */
export const TIERS = [
  { name: 'Bronze', minXp: 0 }, { name: 'Silver', minXp: 1000 }, { name: 'Gold', minXp: 2500 },
  { name: 'Platinum', minXp: 5000 }, { name: 'Diamond', minXp: 10000 },
] as const;
export const tierFor = (xp: number) => [...TIERS].reverse().find((t) => xp >= t.minXp)!.name;
export const bandFor = (pct: number, bands: { label: string; minPct: number }[]) =>
  [...bands].sort((a, b) => b.minPct - a.minPct).find((b) => pct >= b.minPct)?.label ?? null;

/* ───────────── published snapshot (QuizVersion.snapshot) ───────────── */
export interface PublishedQuestion {
  id: string; type: QuestionType; text: string; explanation: string; points: number; sectionId: string | null; position: number;
  config: QuestionConfig; options: { id: string; text: string; isCorrect: boolean; position: number }[];
}
export interface PublishedQuiz {
  quizId: string; number: number; title: string; settings: QuizSettings;
  sections: { id: string; title: string; position: number }[];
  /** ordered by section position then question position */
  questions: PublishedQuestion[]; totalPoints: number;
}
