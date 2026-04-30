import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const inputId = id ?? label.replace(/\s/g, '-').toLowerCase();
    return (
      <div className="space-y-1.5">
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
        <div className="relative">
          {icon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {icon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              'w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-2.5 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500',
              icon ? 'pl-10 pr-3' : 'px-3',
              className
            )}
            {...props}
          />
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
