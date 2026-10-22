import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium select-none transition-[background-color,color,border-color,transform] duration-[var(--dur-fast)] active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent-hover',
        secondary: 'bg-surface-2 text-text border border-border hover:border-border-strong',
        outline: 'border border-border-strong bg-transparent text-text hover:bg-surface-2',
        ghost: 'bg-transparent text-text hover:bg-surface-2',
        danger: 'bg-danger text-bg hover:opacity-90',
        link: 'text-accent underline-offset-4 hover:underline px-0 h-auto min-h-0',
      },
      size: {
        sm: 'h-8 min-h-8 px-3 text-sm',
        md: 'h-10 min-h-10 px-4 text-sm',
        lg: 'h-12 min-h-12 px-6 text-base',
        icon: 'size-10 min-h-10 min-w-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? children : (<>{loading && <Spinner className="size-4" />}{children}</>)}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
