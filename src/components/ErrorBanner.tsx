import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss }) => {
  return (
    <div className="flex items-center justify-between p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs gap-3">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <span className="font-medium">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
