import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000); // exactly 4 seconds
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-100',
    error: 'border-rose-500/30 bg-rose-50/90 dark:bg-rose-950/90 text-rose-900 dark:text-rose-100',
    info: 'border-blue-500/30 bg-blue-50/90 dark:bg-blue-950/90 text-blue-900 dark:text-blue-100',
  };

  return (
    <div
      data-testid="toast-notification"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className={`flex items-center gap-3 ${borderColors[toast.type]} px-3 py-2 rounded-md`}>
        {icons[toast.type]}
        <span className="text-sm font-medium tracking-tight" data-testid="toast-message">
          {toast.message}
        </span>
        <button
          onClick={onDismiss}
          data-testid="btn-dismiss-toast"
          className="ml-2 p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss toast"
        >
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>
    </div>
  );
};
