import React from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast, language } = useAppStore();
  const isAr = language === 'ar';

  return (
    <div
      id="toast-container"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-full px-4"
    >
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';
          const isError = toast.type === 'error';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all ${
                isSuccess
                  ? 'bg-[#0B1712]/95 border-[#687B61]/60 text-[#E8E0CF]'
                  : isWarning
                  ? 'bg-[#1C170E]/95 border-[#B89A5A]/60 text-[#E8E0CF]'
                  : isError
                  ? 'bg-[#1E0F11]/95 border-[#4A2528] text-[#F3D5D7]'
                  : 'bg-[#10231A]/95 border-[#687B61]/40 text-[#E8E0CF]'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 text-[#89977C]" />
                ) : isWarning ? (
                  <AlertCircle className="w-5 h-5 text-[#B89A5A]" />
                ) : isError ? (
                  <AlertCircle className="w-5 h-5 text-[#E57373]" />
                ) : (
                  <Info className="w-5 h-5 text-[#89977C]" />
                )}
              </div>

              <div className="flex-1 text-sm font-medium leading-relaxed">
                {isAr ? toast.messageAr : toast.message}
              </div>

              <button
                id={`toast-close-${toast.id}`}
                onClick={() => removeToast(toast.id)}
                className="text-[#BDB5A5] hover:text-[#E8E0CF] transition-colors p-1"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
