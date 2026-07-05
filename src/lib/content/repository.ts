import { FieldValue } from "firebase-admin/firestore";
import type { ContentCard } from "../domain/types";
import { getAdminDb } from "../firebase/admin";
import { CARDS } from "./cards";

// The data source for content cards. Single seam between the app and storage:
// when Firestore is configured it reads/writes there; otherwise it serves the
// in-memory seed so the app runs before Firebase is connected.

export const CARDS_COLLECTION = "content_cards";

/** All cards, from Firestore when available, else the seed. */
export async function getAllCards(): Promise<ContentCard[]> {
  const db = getAdminDb();
  if (!db) return CARDS;
  const snap = await db.collection(CARDS_COLLECTION).get();
  // Empty collection => not seeded yet; fall back so screens aren't blank.
  if (snap.empty) return CARDS;
  return snap.docs.map((doc) => doc.data() as ContentCard);
}

export async function getCardById(id: string): Promise<ContentCard | undefined> {
  const db = getAdminDb();
  if (!db) return CARDS.find((card) => card.id === id);
  const doc = await db.collection(CARDS_COLLECTION).doc(id).get();
  if (doc.exists) return doc.data() as ContentCard;
  return CARDS.find((card) => card.id === id);
}

export interface UsageResult {
  usedCount: number;
  /** True when this teacher had already marked the card before (no double count). */
  alreadyUsed: boolean;
}

/**
 * Record one teacher's "우리 반에서 써봤어요" — the field-validation signal.
 * Deduped per teacher: a usage_signal doc at content_cards/{id}/usage/{uid}
 * gates the usedCount increment, so the same teacher can't inflate the count.
 * Runs in a transaction. Returns null when Firestore is not configured.
 */
export async function recordUsageForUser(
  id: string,
  uid: string,
): Promise<UsageResult | null> {
  const db = getAdminDb();
  if (!db) return null;
  const cardRef = db.collection(CARDS_COLLECTION).doc(id);
  const signalRef = cardRef.collection("usage").doc(uid);

  return db.runTransaction(async (tx) => {
    const [card, signal] = await Promise.all([tx.get(cardRef), tx.get(signalRef)]);
    const current = typeof card.data()?.usedCount === "number" ? card.data()!.usedCount : 0;
    if (signal.exists) return { usedCount: current, alreadyUsed: true };
    tx.set(signalRef, { usedAt: FieldValue.serverTimestamp() });
    tx.set(cardRef, { usedCount: FieldValue.increment(1) }, { merge: true });
    return { usedCount: current + 1, alreadyUsed: false };
  });
}
