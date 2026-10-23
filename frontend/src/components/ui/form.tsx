import { Children, createContext, isValidElement, useContext, useId, type LabelHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import type { FieldError } from 'react-hook-form';
import { cn } from '@/lib/utils';

export function Label({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-text', className)} {...p} />;
}

interface FieldProps {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  'aria-required'?: true;
}
const FieldContext = createContext<FieldProps | null>(null);

/**
 * Accessibility props from the enclosing <FormField> (id, aria-invalid, aria-describedby, aria-required).
 * Input, Textarea and SelectTrigger spread these, so the label always points at the real control —
 * even when the control is wrapped (Controller, Radix Select root, a div with chips…).
 */
export const useFieldProps = (): Partial<FieldProps> => useContext(FieldContext) ?? {};

interface FormFieldProps {
  label: ReactNode;
  /** the control (Input, Textarea, Select…) or a wrapper containing exactly one of them */
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
  const only = isValidElement(Children.only(children)) ? children : null;
  const id = (only?.props.id as string | undefined) ?? `f${uid}`;
  const msg = typeof error === 'string' ? error : error?.message;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = msg ? `${id}-err` : undefined;
  const field: FieldProps = {
    id,
    'aria-invalid': msg ? true : undefined,
    'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
    'aria-required': required ? true : undefined,
  };
  return (
    <FieldContext.Provider value={field}>
      <div className={cn('grid gap-1.5', className)}>
        <Label htmlFor={id}>
          {label}
          {required && <span className="ml-0.5 text-accent" aria-hidden="true">*</span>}
        </Label>
        {trailing ? <div className="relative">{children}{trailing}</div> : children}
        {hint && <p id={hintId} className="text-xs text-muted">{hint}</p>}
        {msg && <p id={errId} role="alert" className="text-xs font-medium text-danger">{msg}</p>}
      </div>
    </FieldContext.Provider>
  );
}
