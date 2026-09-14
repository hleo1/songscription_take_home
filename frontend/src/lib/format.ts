import type { PracticeLog, Song } from "./models";

/** Pitch-class names, indexed by root (C = 0 … B = 11). */
export const NOTES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
];

const DAY_MS = 86400000;
// Day boundaries are UTC throughout, matching the server's "added today" sort.
const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Seconds → "m:ss". */
export const fmtDuration = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/** Practice durations are stored as fractional minutes; show whole minutes + seconds. */
export const fmtMinSec = (minutes: number) => {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
};

export const weekday = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });

export const isNew = (s: Song) => s.addedAt.slice(0, 10) === todayUtc();

/** Label for a song with no practice yet. */
export const unpracticedLabel = (s: Song) =>
  isNew(s) ? "New" : "Not practiced";

export const relTime = (date: string) => {
  const days = Math.max(
    0,
    Math.floor(
      (Date.parse(todayUtc()) - Date.parse(date.slice(0, 10))) / DAY_MS,
    ),
  );
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
};

/** Per-day practice totals for the `n` days ending today, oldest first. */
export function lastNDays(history: PracticeLog[], n: number) {
  const end = Date.parse(todayUtc());
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(end - (n - i - 1) * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const logs = history.filter((h) => h.date.startsWith(date));
    return {
      date,
      sessions: logs.length,
      minutes: logs.reduce((a, h) => a + h.minutes, 0),
      accuracy: logs.length
        ? Math.round(logs.reduce((a, h) => a + h.accuracy, 0) / logs.length)
        : 0,
    };
  });
}
