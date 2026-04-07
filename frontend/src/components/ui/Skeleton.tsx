import { cn } from './cn';

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-shimmer rounded-lg', className)} />
);
