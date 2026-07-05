import type { ExternalFeedItem } from "../domain/types";
import { getAdminDb } from "../firebase/admin";

// Read side of the auto-collected external info feed. Writes happen in
// scripts/collect-feed.mjs (the ported RSS collector). Empty when Firestore is
// not configured or nothing has been collected yet.

export const FEED_COLLECTION = "external_feed";

export async function listFeedItems(limit = 30): Promise<ExternalFeedItem[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db
    .collection(FEED_COLLECTION)
    .orderBy("publishedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((doc) => doc.data() as ExternalFeedItem);
}
