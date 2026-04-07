import { cn } from './cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, className, ...props }: InputProps) => (
  <label className="block space-y-1">
    {label && <span className="text-sm font-semibold text-slate-200">{label}</span>}
    <input
      className={cn(
        'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none',
        className
      )}
      {...props}
    />
    {error && <span className="text-xs text-red-400">{error}</span>}
  </label>
);
