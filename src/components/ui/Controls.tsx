import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { useMotionSpeed } from "@/lib/motion";

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const speed = useMotionSpeed();
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full p-1 transition-colors disabled:opacity-40 ${
        checked ? "bg-ink" : "bg-tint/15"
      }`}
    >
      <motion.span
        layout
        transition={speed({ type: "spring", stiffness: 600, damping: 36 })}
        className={`block size-6 rounded-full shadow-md ${checked ? "ml-auto bg-inverse" : "bg-ink/90"}`}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  layoutId,
}: {
  value: T;
  options: { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  label: string;
  layoutId: string;
}) {
  const speed = useMotionSpeed();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-tint/8 p-1">
      {options.map(({ value: v, label: l, icon: Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`relative flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={speed({ type: "spring", stiffness: 500, damping: 38 })}
                className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-tint/10"
              />
            )}
            {Icon && <Icon className="relative size-4" />}
            <span className="relative">{l}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * One settings row. Text is fixed, never swapped on toggle, so flipping a switch can't
 * reflow the rows around it. Unavailable options dim instead of growing a warning.
 */
export function SettingRow({
  title,
  description,
  children,
  disabled,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className={`min-w-0 transition-opacity ${disabled ? "opacity-45" : ""}`} aria-disabled={disabled || undefined}>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsSection({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-[0.16em] text-muted">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="divide-y divide-tint/6 overflow-hidden rounded-[24px] bg-card ring-1 ring-tint/5">{children}</div>
    </section>
  );
}
