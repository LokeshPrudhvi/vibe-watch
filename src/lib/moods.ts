import { Brain, Coffee, Smile, Zap, type LucideIcon } from "lucide-react";
import { MOODS as MOOD_RULES, type Mood as MoodRules, type MoodId } from "../../shared/moods";

/** Mood rules live in shared/; the web adds its icon and CSS colour token. */
export { GENRES, MOOD_ORDER, type MoodId } from "../../shared/moods";

export interface Mood extends MoodRules {
  color: string;
  icon: LucideIcon;
}

const ICONS: Record<MoodId, LucideIcon> = { cozy: Coffee, mind: Brain, feel: Smile, edge: Zap };

/**
 * Written out in full on purpose: Tailwind only emits theme variables it can find in the
 * source, so a template like `var(--color-${id})` silently drops --color-cozy/--color-mind
 * and the active mood chip turns invisible.
 */
const COLORS: Record<MoodId, string> = {
  cozy: "var(--color-cozy)",
  mind: "var(--color-mind)",
  feel: "var(--color-feel)",
  edge: "var(--color-edge)",
};

export const MOODS = Object.fromEntries(
  Object.values(MOOD_RULES).map((m) => [m.id, { ...m, color: COLORS[m.id], icon: ICONS[m.id] }]),
) as Record<MoodId, Mood>;
