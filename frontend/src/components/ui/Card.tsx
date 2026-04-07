import { cn } from './cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const Card = ({ className, padded = true, ...props }: CardProps) => (
  <div
    className={cn(
      'rounded-2xl border border-slate-800 bg-white/5 backdrop-blur-lg shadow-[0_12px_40px_rgba(0,0,0,0.35)]',
      padded ? 'p-6' : '',
      className
    )}
    {...props}
  />
);
