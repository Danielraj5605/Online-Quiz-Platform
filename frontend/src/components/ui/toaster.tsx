import { Toaster as Sonner } from 'sonner';
import { useTheme } from '@/app/theme';

/** Sonner themed to tokens. Call `toast.success(...)` from 'sonner' anywhere. */
export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      theme={resolved}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: '!rounded-md !border !border-border !bg-surface !text-text !shadow-[var(--shadow-2)] !font-sans',
          description: '!text-muted',
        },
      }}
    />
  );
}
