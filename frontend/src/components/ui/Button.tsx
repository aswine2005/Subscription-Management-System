import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline focus-visible:outline-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        {
          primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600',
          secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
          outline: 'bg-transparent border border-slate-200 text-slate-700 hover:bg-slate-100',
          ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
          danger: 'bg-rose-600 hover:bg-rose-700 text-white',
          success: 'bg-[#426347] hover:bg-[#35533b] text-white',
        }[variant],
        {
          sm: 'text-[11px] px-3 py-2 gap-1.5',
          md: 'text-xs px-4 py-2.5 gap-2',
          lg: 'text-sm px-5 py-3 gap-2.5',
        }[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <Loader2 size={14} className="animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  ),
);
Button.displayName = 'Button';
