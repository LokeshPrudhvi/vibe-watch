import { AnimatePresence, motion } from "motion/react";
import { Undo2 } from "lucide-react";
import { useToast } from "@/store/useToast";

export function Toaster() {
  const toast = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 12px) + 80px)" }}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="glass glass-float pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2 pl-5 pr-2 text-sm font-medium"
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                onClick={() => {
                  toast.undo?.();
                  dismiss();
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-tint/10 px-3 font-semibold hover:bg-tint/15"
              >
                <Undo2 className="size-4" /> Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
