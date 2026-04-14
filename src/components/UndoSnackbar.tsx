import React, { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const DISPLAY_MS = 4000;

export type UndoSnackbarProps = {
  open: boolean;
  undoKey: number;
  message: string;
  onUndo: () => void | Promise<void>;
  onDismiss: () => void;
  /** `aboveMobileTabs`: Abstand zur mobilen Unter-Navigation (Trip-Ansicht) */
  variant?: 'default' | 'aboveMobileTabs';
};

export function UndoSnackbar({
  open,
  undoKey,
  message,
  onUndo,
  onDismiss,
  variant = 'default',
}: UndoSnackbarProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const onUndoRef = useRef(onUndo);
  onDismissRef.current = onDismiss;
  onUndoRef.current = onUndo;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    dismissedRef.current = false;
    if (!open) {
      clearTimer();
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!dismissedRef.current) onDismissRef.current();
    }, DISPLAY_MS);
    return () => clearTimer();
  }, [open, undoKey]);

  const handleUndo = useCallback(async () => {
    dismissedRef.current = true;
    clearTimer();
    await onUndoRef.current();
    onDismissRef.current();
  }, []);

  return (
    <div
      className={cn(
        'fixed z-[200] pointer-events-none inset-x-0 bottom-0 flex justify-end p-3 sm:p-4',
        'pr-[max(0.75rem,env(safe-area-inset-right))]',
        variant === 'default' && 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        variant === 'aboveMobileTabs' &&
          'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
      )}
    >
      <AnimatePresence mode="wait">
        {open && (
          <motion.div
            key={undoKey}
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 22, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.38, ease: EASE }}
            className="pointer-events-auto w-full max-w-md sm:max-w-lg"
          >
            <div
              className={cn(
                'glass-card flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between',
                'px-3.5 py-3 sm:px-4 sm:py-3 shadow-lg border border-border/80',
              )}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{
                    background: 'var(--gradient-primary)',
                    boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)',
                  }}
                  aria-hidden
                >
                  <Undo2 className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <p className="text-sm text-foreground leading-snug pt-0.5">{message}</p>
              </div>
              <motion.button
                type="button"
                onClick={() => void handleUndo()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'shrink-0 self-stretch sm:self-center rounded-xl px-4 py-2.5 sm:py-2 text-sm font-semibold text-white',
                  'min-h-[44px] sm:min-h-0',
                )}
                style={{
                  background: 'var(--gradient-primary)',
                  boxShadow: '0 2px 10px oklch(0.24 0.030 255 / 18%)',
                }}
              >
                Rückgängig
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
