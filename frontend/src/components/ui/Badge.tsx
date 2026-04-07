import { cn } from './cn';

type Tone = 'primary' | 'muted' | 'amber' | 'green';

const tones: Record<Tone, string> = {
  primary: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  muted: 'bg-white/5 text-slate-400 border border-white/10',
  amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  green: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
};

export const Badge = ({ tone = 'muted', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold', tones[tone], className)}>
    {children}
  </span>
);
