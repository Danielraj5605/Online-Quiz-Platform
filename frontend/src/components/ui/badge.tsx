import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import type { AttemptStatus, QuizStatus } from '@quiz/shared';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-surface-2 text-text',
      accent: 'bg-accent-soft text-accent',
      teal: 'bg-teal-soft text-teal',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger',
    },
    outline: { true: 'border border-current bg-transparent', false: '' },
  },
  defaultVariants: { tone: 'neutral', outline: false },
});
export type Tone = NonNullable<VariantProps<typeof badge>['tone']>;

export function Badge({ className, tone, outline, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone, outline }), className)} {...p} />;
}

const QUIZ: Record<QuizStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SCHEDULED: { label: 'Scheduled', tone: 'teal' },
  LIVE: { label: 'Live', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'warning' },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
};
const ATTEMPT: Record<AttemptStatus | 'NOT_STARTED', { label: string; tone: Tone }> = {
  NOT_STARTED: { label: 'Not started', tone: 'neutral' },
  IN_PROGRESS: { label: 'In progress', tone: 'teal' },
  SUBMITTED: { label: 'Awaiting grading', tone: 'warning' },
  GRADED: { label: 'Graded', tone: 'success' },
  EXPIRED: { label: 'Expired', tone: 'danger' },
};

/** Lifecycle / attempt state badge. A dot + text — colour is never the only signal. */
export function StatusBadge({ status, kind = 'quiz' }: { status: string; kind?: 'quiz' | 'attempt' }) {
  const m = (kind === 'quiz' ? QUIZ : ATTEMPT)[status as never] as { label: string; tone: Tone } | undefined;
  const { label, tone } = m ?? { label: status, tone: 'neutral' as Tone };
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}
