import { Award, CalendarCheck, Flame, Footprints, Repeat, Sparkles, Timer, Trophy, Zap, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints, sparkles: Sparkles, repeat: Repeat, flame: Flame, zap: Zap,
  'calendar-check': CalendarCheck, timer: Timer, trophy: Trophy,
};

/** Maps the badge `icon` slug from the API to a lucide icon. */
export function BadgeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Award;
  return <Icon className={className} aria-hidden="true" />;
}
