/** Response shapes not covered by @quiz/shared (see docs/API.md). Agents extend this file additively. */
import type { AnswerValue, AttemptStatus, QuestionConfig, QuestionType, QuizOverviewDto, QuizStatus, Role } from '@quiz/shared';

export interface Category { id: string; name: string; slug: string }
export interface Tag { id: string; name: string }
export interface AttemptHistoryItem {
  attemptId: string; quizId: string; quizTitle: string; number: number; status: AttemptStatus;
  percentage: number | null; passed: boolean | null; band: string | null; isFinal: boolean;
  startedAt: string; submittedAt: string | null;
}
export interface ProgressDto {
  trend: { date: string; pct: number }[];
  byCategory: { category: string; avgPct: number; count: number }[];
  totals: { attempts: number; avgPct: number; passed: number; bestPct: number };
}
export interface AssignmentsDto { inProgress: QuizOverviewDto[]; assigned: QuizOverviewDto[]; upcoming: QuizOverviewDto[] }
export interface BadgeDto { key: string; name: string; description: string; icon: string; awardedAt?: string | null; earned?: boolean }
/** `badges` lists every badge; `earned` tells which the user holds. */
export interface GamificationDto {
  xp: number; tier: string; nextTier: { name: string; minXp: number } | null; streakDays: number; badges: BadgeDto[];
}
export interface XpLeaderboardRow { rank: number; userId: string; username: string; name: string | null; avatarUrl: string | null; xp: number; tier: string }
export interface QuizLeaderboardRow {
  rank: number; userId: string; username: string; name: string | null; avatarUrl: string | null;
  percentage: number; score: number; maxScore: number; durationSec: number | null;
}
export type DailyChallengeDto = QuizOverviewDto & { xpBonus: number; date: string; completedToday: boolean };
export interface VersionDto { id: string; number: number; createdAt: string; attemptCount: number }
export interface AccessDto {
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'; accessCode: string | null;
  cohorts: { id: string; name: string; memberCount: number }[]; users: { id: string; username: string; name: string | null }[];
}
export interface CohortDto { id: string; name: string; description: string; memberCount: number; createdAt: string }
export interface CohortMember { id: string; username: string; name: string | null; email: string; avatarUrl: string | null; addedAt: string }
export interface CohortDetailDto extends CohortDto { members: CohortMember[] }
export interface AddMembersResult { added: number; notFound: string[]; members: CohortMember[] }
export interface BankQuestionDto {
  id: string; type: QuestionType; text: string; explanation: string; points: number; tags: string[];
  categoryId: string | null; options: { text: string; isCorrect: boolean }[]; config: QuestionConfig; createdAt: string;
}
export interface MonitorParticipant {
  userId: string; username: string; name: string | null; attemptId: string; attemptNumber: number; status: AttemptStatus;
  startedAt: string; expiresAt: string | null; submittedAt: string | null;
  answered: number; total: number; tabSwitches: number; lastSeenAt: string;
}
/** `notStarted` is a count only (invited/assigned users with no attempt) — they are not listed in `participants`. */
export interface MonitorDto {
  participants: MonitorParticipant[];
  counts: { inProgress: number; submitted: number; notStarted: number };
}
export interface GradingSubmission {
  attemptId: string; attemptNumber: number; status: AttemptStatus; submittedAt: string | null;
  user: { id: string; username: string; name: string | null };
  pendingCount: number; manualCount: number; percentage: number | null;
}
export interface GradingItemGrade {
  autoScore: number | null; manualScore: number | null; needsManual: boolean; isCorrect: boolean | null; maxScore: number;
  feedback: string; rubricScores: number[] | null; gradedAt: string | null; effective: number;
}
export interface GradingItem {
  questionId: string; type: QuestionType; text: string; points: number; explanation: string; config: QuestionConfig;
  options: { id: string; text: string; isCorrect: boolean; position: number }[];
  answerId: string | null; value: AnswerValue | null; timeSpentMs: number; flagged: boolean; grade: GradingItemGrade | null;
}
/** GET /attempts/:id/grading */
export interface GradingAttemptDto {
  attemptId: string; quizId: string; status: AttemptStatus; submittedAt: string | null; durationSec: number | null;
  tabSwitches: number; blurSeconds: number;
  user: { id: string; username: string; name: string | null; avatarUrl: string | null };
  items: GradingItem[];
}
/** PUT /attempts/:id/grading */
export interface GradeSaveResult { attemptId: string; isFinal: boolean; score: number; maxScore: number; percentage: number }
/** POST /quizzes/:id/grading/bulk */
export interface BulkGradeResult { graded: number; attempts: number; finalized: number }
export interface ReportSummary {
  attempts: number; participants: number; avgPct: number; medianPct: number; passRate: number; avgDurationSec: number;
  distribution: { bucket: string; count: number }[]; bands: { label: string; count: number }[]; gradedPending: number;
}
export interface ItemAnalysisRow {
  questionId: string; text: string; type: QuestionType; points: number; responses: number;
  /** p-value 0..1 (share of points earned); null until graded responses exist */
  difficulty: number | null;
  /** upper27% − lower27% (−1..1); null when groups are empty */
  discrimination: number | null;
  avgTimeMs: number; omitRate: number; distractors: { optionId: string; text: string; count: number; isCorrect: boolean }[];
}
export interface ParticipantReportRow { userId: string; username: string; name: string | null; attempts: number; bestPct: number; lastPct: number; passed: boolean; avgDurationSec: number }
export interface CohortReportRow { cohortId: string; name: string; members: number; attempted: number; avgPct: number; passRate: number }
export interface OrganizerDashboard {
  kpis: { liveQuizzes: number; participants: number; avgScorePct: number; needsGrading: number };
  liveQuizzes: { id: string; title: string; attempts: number; closesAt: string | null }[];
  needsGrading: { quizId: string; title: string; count: number }[];
  recentActivity: { attemptId: string; quizId: string; quizTitle: string; username: string; name: string | null; status: AttemptStatus; at: string }[];
}
export interface AdminUserRow {
  id: string; username: string; email: string; name: string | null; role: Role; disabled: boolean; createdAt: string;
  xp: number; tier: string; quizCount: number; attemptCount: number;
}
/** Matches backend/src/modules/admin/service.ts `analytics()`. */
export interface AdminAnalytics {
  totals: { users: number; quizzes: number; attempts: number; finalResults: number; newUsers7d: number; avgScorePct: number; openFlags: number };
  usersByRole: { role: Role; count: number }[];
  quizzesByStatus: { status: QuizStatus; count: number }[];
  attemptsPerDay: { date: string; count: number }[];
  signupsPerDay: { date: string; count: number }[];
  topQuizzes: { id: string; title: string; owner: string; attempts: number }[];
}
export interface ModerationItem {
  id: string; entityType: 'QUIZ' | 'REVIEW' | 'USER' | string; entityId: string; reason: string;
  status: 'OPEN' | 'DISMISSED' | 'ACTIONED'; createdAt: string; resolution: string | null; resolvedById: string | null;
  reporter: { id: string; username: string }; entityLabel: string | null;
}
export interface AuditRow {
  id: string; action: string; entityType: string; entityId: string | null; actor: { id: string; username: string } | null;
  meta: unknown; ip: string | null; createdAt: string;
}
export interface AdminQuizRow {
  id: string; title: string; status: QuizStatus; visibility: string; isFlagged: boolean; createdAt: string;
  owner: { id: string; username: string }; attemptCount: number; questionCount: number;
}
export interface ReviewsDto {
  items: {
    id: string; rating: number; comment: string; createdAt: string;
    user: { id: string; username: string; name: string | null; avatarUrl: string | null };
  }[];
  average: number | null; count: number; mine: { id: string; rating: number; comment: string } | null;
}
