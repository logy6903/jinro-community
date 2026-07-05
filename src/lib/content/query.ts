import type { ContentCard, SchoolLevel } from "../domain/types";
import { getActiveTags } from "../calendar/engine";
import { getAllCards } from "./repository";

// The curation entry point used by both the home page and the kakao-daily
// feed. Calendar filtering runs in memory on top of whatever the repository
// returns (Firestore or seed).

export { getCardById } from "./repository";

/**
 * Cards to surface for a level "right now": those whose calendar tags
 * intersect the currently-active tags, ranked by field-validation count
 * (used_count) so what teachers actually used floats to the top.
 */
export async function getCardsForNow(
  level: SchoolLevel,
  now: Date = new Date(),
): Promise<ContentCard[]> {
  const active = new Set(getActiveTags(level, now));
  const all = await getAllCards();
  return all
    .filter(
      (card) =>
        card.schoolLevel === level &&
        card.calendarTags.some((tag) => active.has(tag)),
    )
    .sort((a, b) => b.usedCount - a.usedCount);
}
