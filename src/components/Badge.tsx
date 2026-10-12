import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'outline';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium rounded-full gap-1',
    md: 'text-xs px-2.5 py-1 font-medium rounded-full gap-1.5',
  };

  const variantStyles = {
    primary: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700/60',
    outline: 'bg-transparent text-slate-400 border border-slate-700',
  };

  const dotColors = {
    primary: 'bg-orange-500',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center tracking-wide whitespace-nowrap ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotColors[variant]}`}
        />
      )}
      {children}
    </span>
  );
};
