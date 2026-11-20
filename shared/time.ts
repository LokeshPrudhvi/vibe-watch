export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const addMinutes = (d: Date, min: number) => new Date(d.getTime() + min * 60_000);

export function formatClock(d: Date) {
  return d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
}

/** Minutes from now until the next occurrence of `hour`:00 (0 = midnight). */
export function minutesUntil(hour: number, now = new Date()) {
  const t = new Date(now);
  t.setHours(hour, 0, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return Math.round((t.getTime() - now.getTime()) / 60_000);
}

export function dayPart(now = new Date()) {
  const h = now.getHours();
  const day = now.toLocaleDateString("en-IN", { weekday: "long" });
  const part = h < 5 ? "late night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night";
  return `${day} ${part}`;
}
