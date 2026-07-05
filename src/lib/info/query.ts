import type { InfoItem } from "@/lib/domain/types";
import type { FacetKey } from "./facets";

export type FacetSelection = Partial<Record<FacetKey, string>>;

/**
 * Filter items by the selected facet values. Empty/undefined facets are
 * ignored (= "전체"). "공통"(both) items match any 학교급 filter, and
 * "전학년"(all) items match any 학년 filter — so broadly-applicable material
 * is never hidden by a narrower selection.
 */
export function filterInfoItems(
  items: InfoItem[],
  sel: FacetSelection,
): InfoItem[] {
  const filtered = items.filter((it) => {
    if (sel.type && it.type !== sel.type) return false;
    if (sel.category && it.category !== sel.category) return false;
    if (sel.grade && sel.grade !== it.grade && it.grade !== "all") return false;
    if (sel.source && it.source !== sel.source) return false;
    if (sel.timing && it.timing !== sel.timing) return false;
    if (sel.level) {
      if (sel.level === "both") {
        if (it.level !== "both") return false;
      } else if (it.level !== sel.level && it.level !== "both") {
        return false;
      }
    }
    return true;
  });
  // Newest first (publishedAt is ISO, so string compare = chronological).
  return filtered.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
