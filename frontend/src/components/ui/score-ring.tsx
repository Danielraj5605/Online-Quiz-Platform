import { cn } from '@/lib/utils';

/** Circular score gauge. Colour + numeric text + aria-label, so it never relies on colour alone. */
export function ScoreRing({ value, size = 120, stroke = 10, passed, label, className }: {
  value: number; size?: number; stroke?: number; passed?: boolean; label?: string; className?: string;
}) {
  const v = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = passed === undefined ? 'var(--accent)' : passed ? 'var(--success)' : 'var(--danger)';
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Score'}: ${Math.round(v)} percent`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 700ms var(--ease)' }}
        />
      </svg>
      <span className="num absolute text-center font-semibold" style={{ fontSize: size * 0.24 }} aria-hidden="true">{Math.round(v)}%</span>
    </div>
  );
}
