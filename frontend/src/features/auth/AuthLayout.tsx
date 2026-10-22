import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SkipLink } from '@/components/ui/surfaces';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/** A stylised answer sheet: the visual signature of the product ("Marking Pen"). Decorative only. */
function AnswerSheet() {
  const rows = [
    { q: '01', pick: 1, mark: 'ok' },
    { q: '02', pick: 3, mark: 'ok' },
    { q: '03', pick: 0, mark: 'no' },
    { q: '04', pick: 2, mark: 'ok' },
  ];
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm -rotate-2 rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-2)]">
      <div className="mb-4 flex items-baseline justify-between border-b border-dashed border-border-strong pb-3">
        <span className="font-display text-lg font-semibold">Midterm · Part A</span>
        <span className="num text-xs text-muted">45:00</span>
      </div>
      <ul className="grid gap-3.5">
        {rows.map((r) => (
          <li key={r.q} className="flex items-center gap-3">
            <span className="num w-6 text-sm text-muted">{r.q}</span>
            <span className="flex gap-2">
              {['A', 'B', 'C', 'D'].map((l, i) => (
                <span
                  key={l}
                  className={`num grid size-7 place-items-center rounded-full border text-xs ${i === r.pick ? 'border-text bg-text text-bg' : 'border-border-strong text-muted'}`}
                >
                  {l}
                </span>
              ))}
            </span>
            <span className={`ml-auto font-display text-lg ${r.mark === 'ok' ? 'text-accent' : 'text-muted line-through'}`}>{r.mark === 'ok' ? '✓' : '✗'}</span>
          </li>
        ))}
      </ul>
      <div className="animate-stamp absolute -bottom-5 -right-3 rotate-[8deg] rounded-md border-[3px] border-accent bg-surface px-3 py-1 font-display text-2xl font-bold uppercase tracking-wider text-accent">
        <span className="num">75</span>% · Pass
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <SkipLink />
      <aside className="paper-grain relative hidden flex-col justify-between overflow-hidden bg-surface-2 p-12 lg:flex">
        <Link to="/login" className="inline-flex items-center gap-2 font-display text-2xl font-semibold" aria-label="Quizzo">
          <span className="grid size-8 place-items-center rounded-md bg-text text-bg"><Check className="size-5 text-accent" strokeWidth={3.2} /></span>
          Quizzo
        </Link>
        <div>
          <h2 className="max-w-md text-balance text-5xl font-semibold leading-[1.05]">
            Set the paper.<br />Take the test.<br /><span className="text-accent">Mark what matters.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg text-muted">Quizzes for classrooms and teams — timed, fair, graded with rubrics, reported with real item analysis.</p>
        </div>
        <AnswerSheet />
      </aside>

      <main id="main" tabIndex={-1} className="relative flex flex-col px-5 py-6 outline-none sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/login" className="inline-flex items-center gap-2 font-display text-xl font-semibold lg:hidden" aria-label="Quizzo">
            <span className="grid size-7 place-items-center rounded-md bg-text text-bg"><Check className="size-4 text-accent" strokeWidth={3.2} /></span>
            Quizzo
          </Link>
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
          <h1 className="text-4xl font-semibold">{title}</h1>
          <p className="mb-8 mt-2 text-muted">{subtitle}</p>
          {children}
          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </main>
    </div>
  );
}
