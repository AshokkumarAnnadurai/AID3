import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-2xl transition-all duration-200';

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6',
  };

  const variantStyles = {
    default: 'bg-slate-900/80 border border-slate-800/80 backdrop-blur-sm shadow-sm',
    elevated:
      'bg-slate-900 border border-slate-800 shadow-xl shadow-black/40',
    interactive:
      'bg-slate-900/90 border border-slate-800 hover:border-orange-500/50 hover:bg-slate-850 hover:shadow-lg hover:shadow-orange-500/5 cursor-pointer active:scale-[0.99]',
    accent:
      'bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-900 border border-orange-500/30 shadow-lg shadow-orange-500/5',
  };

  return (
    <div
      className={`${baseStyles} ${paddingStyles[padding]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
