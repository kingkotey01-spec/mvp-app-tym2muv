import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from './Icon';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const counterRef = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  const iconNameMap: Record<ToastType, string> = {
    success: 'check',
    error: 'alert',
    warning: 'alert',
    info: 'info',
  };

  const bgStyleMap: Record<ToastType, string> = {
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-brand-600 text-white',
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Stack Container */}
      <div 
        id="toast-notifications-stack"
        className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 items-center pointer-events-none select-none"
      >
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              id={`toast-item-${t.id}`}
              key={t.id}
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="pointer-events-auto flex items-center gap-3 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-2xl shadow-xl max-w-sm md:max-w-md"
            >
              <div className={`w-6 h-6 rounded-xl ${bgStyleMap[t.type]} flex items-center justify-center shrink-0 shadow-sm`}>
                <Icon name={iconNameMap[t.type]} size={12} strokeWidth={3} />
              </div>
              <span className="text-sm font-semibold tracking-wide text-slate-100">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Dialog Portal */}
      <AnimatePresence>
        {confirmState && (
          <div 
            id="confirmation-modal-backdrop"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-md"
          >
            <motion.div
              id="confirmation-modal-container"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 max-w-sm w-full relative overflow-hidden"
            >
              {confirmState.title && (
                <h3 id="confirm-dialog-title" className="font-bold text-slate-900 text-lg mb-2 flex items-center gap-2">
                  {confirmState.danger && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  )}
                  {confirmState.title}
                </h3>
              )}
              <p id="confirm-dialog-body" className="text-slate-500 text-sm leading-relaxed mb-6">
                {confirmState.message}
              </p>
              <div className="flex gap-3">
                <button
                  id="confirm-dialog-cancel"
                  type="button"
                  onClick={() => handleConfirmClose(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all text-sm cursor-pointer active:scale-98"
                >
                  {confirmState.cancelLabel || 'Cancel'}
                </button>
                <button
                  id="confirm-dialog-proceed"
                  type="button"
                  onClick={() => handleConfirmClose(true)}
                  className={`flex-1 py-3 text-white rounded-2xl font-bold transition-all text-sm cursor-pointer active:scale-98 shadow-sm ${
                    confirmState.danger 
                      ? 'bg-red-500 hover:bg-red-650 shadow-red-500/10' 
                      : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/10'
                  }`}
                >
                  {confirmState.confirmLabel || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
