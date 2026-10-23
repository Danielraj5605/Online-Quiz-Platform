import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface DayPoint { date: string; count: number }

const H = 220, PAD = { l: 36, r: 8, t: 12, b: 26 };
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Nice axis ceiling so gridlines land on round numbers. */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/**
 * Single-series daily bar chart. One series → no legend box (the card title names it).
 * Thin bars with a rounded data-end, recessive grid, hover/focus tooltip, and a table view for non-visual access.
 */
export function DailyChart({ title, description, data, tone = 'accent', unit }: {
  title: string; description?: string; data: DayPoint[]; tone?: 'accent' | 'teal'; unit: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  // Draw at the real pixel width so axis text stays a readable 11px on phones.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(260, Math.round(e.contentRect.width))); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable]);
  const total = useMemo(() => data.reduce((a, d) => a + d.count, 0), [data]);
  const max = niceMax(Math.max(0, ...data.map((d) => d.count)));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = iw / Math.max(1, data.length);
  const bw = Math.max(3, Math.min(14, step - 3));
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  const peak = data.reduce<DayPoint | null>((b, d) => (!b || d.count > b.count ? d : b), null);
  const fill = tone === 'accent' ? 'var(--accent)' : 'var(--teal)';
  const act = active != null ? data[active] : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description ?? `Last ${data.length} days · ${total.toLocaleString()} ${unit}`}</CardDescription>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-xs font-medium hover:bg-surface-2"
        >
          {asTable ? <BarChart3 className="size-3.5" aria-hidden="true" /> : <Table2 className="size-3.5" aria-hidden="true" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </CardHeader>
      <CardContent>
        {asTable ? (
          <div className="max-h-56 overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-surface-2 text-left text-xs text-muted">
                <tr><th scope="col" className="px-3 py-2 font-medium">Date</th><th scope="col" className="px-3 py-2 text-right font-medium">{unit}</th></tr>
              </thead>
              <tbody>
                {[...data].reverse().map((d) => (
                  <tr key={d.date} className="border-t border-border"><td className="px-3 py-1.5">{day(d.date)}</td><td className="num px-3 py-1.5 text-right">{d.count}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={boxRef} className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width={W}
              height={H}
              className="block max-w-full"
              role="img"
              aria-labelledby={`${id}-t`}
              onMouseLeave={() => setActive(null)}
            >
              <title id={`${id}-t`}>{`${title}: ${total} ${unit} over ${data.length} days${peak ? `, peak ${peak.count} on ${day(peak.date)}` : ''}`}</title>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '2 4'} />
                  <text x={PAD.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="num" fontSize="11" fill="var(--text-muted)">{t}</text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = PAD.l + i * step + (step - bw) / 2;
                const h = Math.max(d.count > 0 ? 2 : 0, ih - (y(d.count) - PAD.t));
                const r = Math.min(4, bw / 2, h);
                return (
                  <g key={d.date} onMouseEnter={() => setActive(i)}>
                    <rect x={PAD.l + i * step} y={PAD.t} width={step} height={ih} fill="transparent" />
                    {h > 0 && (
                      <path
                        d={`M${x},${PAD.t + ih} V${PAD.t + ih - h + r} Q${x},${PAD.t + ih - h} ${x + r},${PAD.t + ih - h} H${x + bw - r} Q${x + bw},${PAD.t + ih - h} ${x + bw},${PAD.t + ih - h + r} V${PAD.t + ih} Z`}
                        fill={fill}
                        opacity={active == null || active === i ? 1 : 0.45}
                      />
                    )}
                    {(data.length - 1 - i) % 7 === 0 && (
                      <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-muted)">{day(d.date)}</text>
                    )}
                  </g>
                );
              })}
              {peak && peak.count > 0 && (() => {
                const i = data.indexOf(peak);
                const x = PAD.l + i * step + step / 2;
                const anchor = x > W - 60 ? 'end' : x < PAD.l + 40 ? 'start' : 'middle';
                return <text x={x} y={y(peak.count) - 5} textAnchor={anchor} fontSize="11" fontWeight="600" className="num" fill="var(--text)">{peak.count}</text>;
              })()}
            </svg>
            {act && active != null && (
              <div
                role="status"
                className={cn('pointer-events-none absolute top-0 z-10 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-[var(--shadow-2)]')}
                style={{ left: `${((PAD.l + active * step + step / 2) / W) * 100}%`, transform: `translateX(${active > data.length / 2 ? '-105%' : '5%'})` }}
              >
                <p className="text-muted">{day(act.date)}</p>
                <p className="num font-semibold">{act.count} {unit}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
