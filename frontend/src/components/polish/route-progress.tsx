import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';

/**
 * Thin progress rule at the top of the viewport while a route's lazy chunk / loader is pending.
 * Routes are code-split with react-router `lazy`, so the old page stays on screen during the fetch —
 * this is the only feedback the user gets. Delayed 120 ms so fast navigations never flash it.
 */
export function RouteProgress() {
  const { state } = useNavigation();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (state === 'idle') return;
    const t = setTimeout(() => setShow(true), 120);
    return () => { clearTimeout(t); setShow(false); };
  }, [state]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden">
      {show && <div className="h-full w-1/3 animate-[route-progress_1s_var(--ease)_infinite] bg-accent" />}
    </div>
  );
}
