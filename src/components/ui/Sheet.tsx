import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useMotionSpeed } from "@/lib/motion";

/** Bottom sheet on phones, centred card on wider screens. Escape / backdrop closes it. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const speed = useMotionSpeed();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const returnFocusTo = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("input, button")?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      returnFocusTo?.focus();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={speed({ type: "spring", stiffness: 380, damping: 34 })}
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-6 text-ink shadow-2xl ring-1 ring-tint/10 sm:max-w-md sm:rounded-[28px] sm:pb-6"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full text-muted hover:bg-tint/10 hover:text-ink"
            >
              <X className="size-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
