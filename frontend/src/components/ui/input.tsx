import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useFieldProps } from './form';

export const fieldClass =
  'w-full rounded-md border border-border-strong bg-surface px-3 text-text placeholder:text-muted/80 transition-colors hover:border-text focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type = 'text', ...p }, ref) => (
  <input ref={ref} type={type} className={cn(fieldClass, 'h-11 text-base sm:h-10 sm:text-sm', className)} {...useFieldProps()} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, rows = 4, ...p }, ref) => (
  <textarea ref={ref} rows={rows} className={cn(fieldClass, 'min-h-24 py-2 text-base sm:text-sm', className)} {...useFieldProps()} {...p} />
));
Textarea.displayName = 'Textarea';
