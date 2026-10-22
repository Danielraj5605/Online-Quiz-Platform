/** Response shapes not covered by @quiz/shared (see docs/API.md). Agents extend this file additively. */
import type { AnswerValue, AttemptStatus, QuestionConfig, QuestionType, QuizOverviewDto, QuizStatus, Role } from '@quiz/shared';

export interface Category { id: string; name: string; slug: string }
export interface Tag { id: string; name: string }
export interface AttemptHistoryItem {
  attemptId: string; quizId: string; quizTitle: string; number: number; status: AttemptStatus;
  percentage: number | null; passed: boolean | null; band: string | null; submittedAt: string | null;
}
export interface ProgressDto {
  trend: { date: string; pct: number }[];
  byCategory: { category: string; avgPct: number; attempts: number }[];
  totals: { attempts: number; avgPct: number; passed: number };
}
export interface AssignmentsDto { inProgress: QuizOverviewDto[]; assigned: QuizOverviewDto[]; upcoming: QuizOverviewDto[] }
export interface BadgeDto { key: string; name: string; description: string; icon: string; awardedAt?: string }
export interface GamificationDto {
  xp: number; tier: string; nextTier: { name: string; minXp: number } | null; streakDays: number; badges: BadgeDto[];
  allBadges?: BadgeDto[];
}
export interface LeaderboardRow {
  rank: number; userId: string; username: string; name: string | null; avatarUrl: string | null; value: number;
  tier?: string; durationSec?: number | null;
}
export interface VersionDto { id: string; number: number; createdAt: string; attemptCount: number }
export interface AccessDto {
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'; accessCode: string | null;
  cohorts: { id: string; name: string }[]; users: { id: string; username: string; name: string | null }[];
}
export interface CohortDto { id: string; name: string; description: string; memberCount: number; createdAt: string }
export interface CohortDetailDto extends CohortDto { members: { userId: string; username: string; name: string | null; email: string }[] }
export interface BankQuestionDto {
  id: string; type: QuestionType; text: string; explanation: string; points: number; tags: string[];
  categoryId: string | null; options: { text: string; isCorrect: boolean }[]; config: QuestionConfig; createdAt: string;
}
export interface MonitorDto {
  participants: {
    userId: string; username: string; status: AttemptStatus | 'NOT_STARTED'; startedAt: string | null; expiresAt: string | null;
    answered: number; total: number; tabSwitches: number; lastSeenAt: string | null;
  }[];
  counts: { inProgress: number; submitted: number; notStarted: number };
}
export interface GradingSubmission {
  attemptId: string; userId: string; username: string; name: string | null; submittedAt: string | null;
  pendingCount: number; totalManual: number; status: AttemptStatus;
}
export interface GradingAnswer {
  answerId: string; questionId: string; text: string; type: QuestionType; points: number;
  answer: AnswerValue | null; needsManual: boolean; score: number | null; autoScore: number | null;
  feedback: string; rubric: { criterion: string; maxPoints: number }[]; rubricScores: number[] | null;
  options: { id: string; text: string; isCorrect: boolean }[]; explanation: string;
}
export interface GradingAttemptDto {
  attemptId: string; quizId: string; quizTitle: string; user: { id: string; username: string; name: string | null };
  status: AttemptStatus; submittedAt: string | null; answers: GradingAnswer[];
}
export interface ReportSummary {
  attempts: number; participants: number; avgPct: number; medianPct: number; passRate: number; avgDurationSec: number;
  distribution: { bucket: string; count: number }[]; bands: { label: string; count: number }[]; gradedPending: number;
}
export interface ItemAnalysisRow {
  questionId: string; text: string; type: QuestionType; difficulty: number; discrimination: number;
  avgTimeMs: number; omitRate: number; distractors: { optionId: string; text: string; count: number; isCorrect: boolean }[];
}
export interface ParticipantReportRow { userId: string; username: string; attempts: number; bestPct: number; lastPct: number; passed: boolean; avgDurationSec: number }
export interface CohortReportRow { cohortId: string; name: string; members: number; attempted: number; avgPct: number; passRate: number }
export interface OrganizerDashboard {
  kpis: { liveQuizzes: number; participants: number; avgScorePct: number; needsGrading: number };
  liveQuizzes: { id: string; title: string; inProgress: number; submitted: number; closesAt: string | null }[];
  needsGrading: { quizId: string; title: string; count: number }[];
  recentActivity: { id: string; text: string; at: string; href?: string }[];
}
export interface AdminUserRow {
  id: string; username: string; email: string; name: string | null; role: Role; disabled: boolean; createdAt: string;
  quizCount: number; attemptCount: number;
}
export interface AdminAnalytics {
  totals: { users: number; organizers: number; quizzes: number; attempts: number; liveQuizzes: number };
  growth: { date: string; users: number; attempts: number }[];
  topQuizzes: { id: string; title: string; attempts: number; avgPct: number }[];
}
export interface ModerationItem {
  id: string; entityType: string; entityId: string; reason: string; status: 'OPEN' | 'DISMISSED' | 'ACTIONED'; createdAt: string;
  reporter: { username: string }; preview?: string;
}
export interface AuditRow {
  id: string; action: string; entityType: string; entityId: string | null; actor: { username: string } | null;
  meta: unknown; ip: string | null; createdAt: string;
}
export interface AdminQuizRow { id: string; title: string; status: QuizStatus; isFlagged: boolean; owner: { username: string }; attemptCount: number; createdAt: string }
export interface ReviewsDto {
  aggregate: { avg: number | null; count: number };
  reviews: {
    id: string; rating: number; comment: string; createdAt: string; mine: boolean;
    user: { id: string; username: string; name: string | null; avatarUrl: string | null };
  }[];
}
