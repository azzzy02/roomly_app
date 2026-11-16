import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastMessage, ToastType } from '@/src/types/chat';

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string, dedupeKey?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const recentKeysRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, description?: string, dedupeKey?: string) => {
      const effectiveKey = dedupeKey || `${type}:${title}:${description || ''}`;
      const now = Date.now();
      const lastShown = recentKeysRef.current.get(effectiveKey);
      if (lastShown && now - lastShown < 2500) {
        return;
      }
      recentKeysRef.current.set(effectiveKey, now);

      const id = `${now}_${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => {
        const filtered = prev.filter((t) => t.dedupeKey !== effectiveKey);
        return [...filtered.slice(-3), { id, type, title, description, dedupeKey: effectiveKey }];
      });

      const timer = window.setTimeout(() => {
        dismissToast(id);
      }, 4200);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-[#151A24] p-3.5 shadow-xl shadow-black/40 transition-all duration-150"
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {toast.type === 'info' && <Info className="h-4 w-4 text-indigo-400" />}
              {toast.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-100">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-slate-400 break-words">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-indigo-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
