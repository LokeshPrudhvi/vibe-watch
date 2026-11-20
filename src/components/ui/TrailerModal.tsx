import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useMotionSpeed } from "@/lib/motion";

interface Props {
  open: boolean;
  videoKey?: string;
  title: string;
  onClose: () => void;
}

export function TrailerModal({ open, videoKey, title, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const speed = useMotionSpeed();

  useEffect(() => {
    if (!open) return;
    const returnFocusTo = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      returnFocusTo?.focus(); // keyboard users land back on the Trailer button
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && videoKey && (
        <motion.div
          className="glass fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} trailer`}
        >
          <motion.div
            className="relative w-full max-w-4xl overflow-hidden rounded-[28px] bg-black shadow-2xl ring-1 ring-tint/10"
            initial={{ scale: 0.92, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={speed({ type: "spring", stiffness: 320, damping: 30 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video">
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&rel=0`}
                title={`${title} trailer`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close trailer"
              className="glass absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-tint/10"
            >
              <X className="size-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
