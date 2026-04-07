import type { ElementType, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = {
  as?: ElementType;
  variant?: Variant;
  loading?: boolean;
  className?: string;
  disabled?: boolean;
  children?: ReactNode;
  // Allow extra props for polymorphic use (e.g., Link props)
  [key: string]: unknown;
};

const base =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 active:scale-95';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 focus:ring-blue-500',
  secondary:
    'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 focus:ring-blue-500',
  ghost: 'bg-transparent text-slate-100 hover:bg-white/10 focus:ring-blue-500',
};

export const Button = ({
  as,
  className,
  variant = 'primary',
  loading,
  disabled,
  children,
  ...rest
}: ButtonProps) => {
  const Component = (as || 'button') as ElementType;
  const isButton = Component === 'button';
  const isDisabled = Boolean(loading || disabled);
  const classes = cn(base, variants[variant], className, isDisabled ? 'pointer-events-none opacity-70' : '');

  if (isButton) {
    return (
      <Component className={classes} disabled={isDisabled} {...rest}>
        {loading ? 'Loading...' : children}
      </Component>
    );
  }

  return (
    <Component
      className={classes}
      aria-disabled={isDisabled}
      {...(isDisabled ? { onClick: (e: any) => e.preventDefault() } : {})}
      {...rest}
    >
      {loading ? 'Loading...' : children}
    </Component>
  );
};
