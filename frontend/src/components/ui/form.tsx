import { Children, cloneElement, isValidElement, useId, type LabelHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils';

export function Label({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-text', className)} {...p} />;
}

interface FormFieldProps {
  label: ReactNode;
  /** a single control (Input, Textarea, Select trigger…) — receives id, aria-invalid, aria-describedby */
  children: ReactElement<Record<string, unknown>>;
  error?: FieldError | string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  /** absolutely-positioned node rendered over the end of the control (e.g. a show-password button) */
  trailing?: ReactNode;
}

/** Label + control + hint + error, wired for screen readers. Works with react-hook-form's `register()` spread on the child. */
export function FormField({ label, children, error, hint, required, className, trailing }: FormFieldProps) {
  const uid = useId();
  const id = (children.props.id as string | undefined) ?? `f${uid}`;
  const msg = typeof error === 'string' ? error : error?.message;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = msg ? `${id}-err` : undefined;
  const control = isValidElement(Children.only(children))
    ? cloneElement(children, {
        id,
        'aria-invalid': msg ? true : undefined,
        'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
        'aria-required': required || undefined,
      })
    : children;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-accent" aria-hidden="true">*</span>}
      </Label>
      {trailing ? <div className="relative">{control}{trailing}</div> : control}
      {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
      {msg && <p id={errId} role="alert" className="text-xs font-medium text-danger">{msg}</p>}
    </div>
  );
}
