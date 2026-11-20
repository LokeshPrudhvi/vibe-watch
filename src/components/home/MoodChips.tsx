import { AnimatePresence, motion } from "motion/react";
import { MOODS, MOOD_ORDER } from "@/lib/moods";
import { useVibeStore } from "@/store/useVibeStore";
import { useMotionSpeed } from "@/lib/motion";

export function MoodChips() {
  const mood = useVibeStore((s) => s.mood);
  const setMood = useVibeStore((s) => s.setMood);
  const speed = useMotionSpeed();

  return (
    <section aria-label="Mood">
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:px-0">
        {MOOD_ORDER.map((id) => {
          const m = MOODS[id];
          const active = id === mood;
          const Icon = m.icon;
          return (
            <motion.button
              key={id}
              onClick={() => setMood(id)}
              whileTap={{ scale: 0.94 }}
              aria-pressed={active}
              className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "text-night" : "bg-card text-ink ring-1 ring-tint/5 hover:bg-card-2"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="mood-active"
                  className="absolute inset-0 rounded-full"
                  style={{ background: m.color, boxShadow: `0 10px 30px -12px ${m.color}` }}
                  transition={speed({ type: "spring", stiffness: 450, damping: 34 })}
                />
              )}
              <Icon className="relative size-4" style={{ color: active ? undefined : m.color }} />
              <span className="relative">{m.label}</span>
            </motion.button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={mood}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={speed({ duration: 0.2 })}
          className="mt-3 text-sm text-muted"
        >
          {MOODS[mood].tagline}
        </motion.p>
      </AnimatePresence>
    </section>
  );
}
