import { getActivePeriods } from "@/lib/calendar/engine";
import { getCardsForNow } from "@/lib/content/query";
import type { SchoolLevel } from "@/lib/domain/types";

// Loose-coupling contract with kakao-daily (the 탄약고 → 총구 seam).
//
// This community owns its own data; it does NOT share a database with
// kakao-daily. Instead it exposes "what to surface this week" as a read-only
// HTTP feed. kakao-daily's collect step can pull this as one more `source` to
// seed its daily generation. Keep the shape stable; it is a public contract.
//
// Depends on the current date, so it is request-time (not cached).

const LEVELS: SchoolLevel[] = ["middle", "high"];

export async function GET() {
  const now = new Date();

  const tracks = await Promise.all(
    LEVELS.map(async (level) => ({
      schoolLevel: level,
      period: getActivePeriods(level, now)[0]?.label ?? null,
      cards: (await getCardsForNow(level, now)).map((card) => ({
        id: card.id,
        category: card.category,
        title: card.title,
        summary: card.summary,
        usedCount: card.usedCount,
        path: `/card/${card.id}`,
      })),
    })),
  );

  return Response.json({
    generatedAt: now.toISOString(),
    tracks,
  });
}
