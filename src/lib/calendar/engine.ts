import type { AcademicPeriod, CalendarTag, SchoolLevel } from "../domain/types";
import { EVERGREEN } from "../domain/types";
import { ACADEMIC_PERIODS } from "./academicCalendar";

// The calendar engine: a small state machine that maps "today" to the
// academic period(s) that are active for a school level, then to the set of
// calendar tags used to pick which cards to surface.
//
// All public functions accept an explicit `now` so the engine is pure and
// testable; callers in the app pass the real current date.

/** Encode a month/day as a comparable integer, e.g. 6/24 -> 624. */
function dayKey(month: number, day: number): number {
  return month * 100 + day;
}

/** True when `now` falls within the period's inclusive MM-DD range (wrap-aware). */
export function isActive(period: AcademicPeriod, now: Date): boolean {
  const key = dayKey(now.getMonth() + 1, now.getDate());
  const [sm, sd] = period.start.split("-").map(Number);
  const [em, ed] = period.end.split("-").map(Number);
  const start = dayKey(sm, sd);
  const end = dayKey(em, ed);
  // Normal range vs. a range that wraps the year boundary (e.g. 12-01 → 02-28).
  return start <= end ? key >= start && key <= end : key >= start || key <= end;
}

/** Academic periods active for a level right now (usually exactly one). */
export function getActivePeriods(
  level: SchoolLevel,
  now: Date = new Date(),
): AcademicPeriod[] {
  return ACADEMIC_PERIODS.filter((p) => p.level === level && isActive(p, now));
}

/**
 * The calendar tags used to select cards: every active period's id, plus the
 * EVERGREEN tag so always-on cards are always eligible.
 */
export function getActiveTags(
  level: SchoolLevel,
  now: Date = new Date(),
): CalendarTag[] {
  return [...getActivePeriods(level, now).map((p) => p.id), EVERGREEN];
}
