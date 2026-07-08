import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type {
  DatasetCategory,
  DatasetLevel,
  InfoGrade,
  InfoItem,
  InfoTiming,
  InfoType,
} from "../domain/types";
import { getAdminDb } from "../firebase/admin";
import { INFO_ITEMS } from "./items";

// 정보 아이템 저장소. kakao-daily가 POST /api/info 로 밀어넣은 항목을
// Firestore info_items 에 upsert 하고, 정보 페이지가 여기서 읽는다.
// Firestore 미설정 시 손수 만든 시드로 폴백(다른 레포지토리와 동일 패턴).

export const INFO_COLLECTION = "info_items";

const TYPES: InfoType[] = ["source", "briefing", "explainer", "data"];
const CATEGORIES: DatasetCategory[] = [
  "admission", "essay", "record", "interview", "result",
  "career", "activity", "contest", "etc",
];
const LEVELS: DatasetLevel[] = ["middle", "high", "both"];
const GRADES: InfoGrade[] = ["middle", "h1", "h2", "h3", "all"];
const TIMINGS: InfoTiming[] = ["recent", "period", "evergreen"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).trim().slice(0, max);
}
function oneOf<T extends string>(v: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

/** 정제된 수신 입력 (kakao-daily push 본문 1건). */
export interface InfoIngestInput {
  id: string;
  type: InfoType;
  category: DatasetCategory;
  level: DatasetLevel;
  grade: InfoGrade;
  source: string;
  timing: InfoTiming;
  title: string;
  summary: string;
  body: string;
  url: string;
  publishedAt: string;
  reviewed: boolean;
}

/** POST 본문 1건을 검증·정규화. 구조가 틀리면 null.
 * 텍스트 콘텐츠(해설·브리핑)는 body를, 파일/외부는 url을 가진다 — 둘 중 하나면 통과. */
export function sanitizeInfoInput(raw: unknown): InfoIngestInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const url = str(r.url, 1000);
  const body = str(r.body, 8000);
  const id = str(r.id, 200) || url; // url을 id 폴백으로(중복방지)
  const title = str(r.title, 200);
  if (!id || !title || (!url && !body)) return null;
  return {
    id,
    type: oneOf(r.type, TYPES, "briefing"),
    category: oneOf(r.category, CATEGORIES, "etc"),
    level: oneOf(r.level, LEVELS, "both"),
    grade: oneOf(r.grade, GRADES, "all"),
    source: str(r.source, 60) || "기타",
    timing: oneOf(r.timing, TIMINGS, "recent"),
    title,
    summary: str(r.summary, 500),
    body,
    url,
    publishedAt: str(r.publishedAt, 30) || new Date().toISOString().slice(0, 10),
    reviewed: r.reviewed === true,
  };
}

function toInfoItem(id: string, d: FirebaseFirestore.DocumentData): InfoItem {
  const collectedAt = d.collectedAt as Timestamp | undefined;
  return {
    id,
    type: d.type ?? "briefing",
    category: d.category ?? "etc",
    level: d.level ?? "both",
    grade: d.grade ?? "all",
    source: d.source ?? "기타",
    timing: d.timing ?? "recent",
    title: d.title ?? "",
    summary: d.summary ?? "",
    body: d.body ?? "",
    url: d.url ?? "",
    publishedAt: d.publishedAt ?? "",
    reviewed: d.reviewed === true,
    collectedAt: collectedAt?.toDate().toISOString() ?? "",
  };
}

/**
 * Upsert 1건. 이미 사람이 검토(reviewed:true)한 문서는 구분·학교급·대상학년을
 * 덮어쓰지 않는다 — 재-push가 교사 보정을 되돌리지 않도록.
 */
export async function upsertInfoItem(input: InfoIngestInput): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  const ref = db.collection(INFO_COLLECTION).doc(input.id);
  const snap = await ref.get();
  const wasReviewed = snap.exists && snap.data()?.reviewed === true;
  const facets = wasReviewed
    ? {} // keep human-corrected facets
    : { category: input.category, level: input.level, grade: input.grade };
  await ref.set(
    {
      type: input.type,
      source: input.source,
      timing: input.timing,
      title: input.title,
      summary: input.summary,
      body: input.body,
      url: input.url,
      publishedAt: input.publishedAt,
      ...facets,
      reviewed: wasReviewed ? true : input.reviewed,
      collectedAt: snap.exists ? snap.data()?.collectedAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}

/** 정보 페이지용 전체 목록. Firestore 없거나 비면 시드로 폴백. */
export async function listInfoItems(): Promise<InfoItem[]> {
  const db = getAdminDb();
  if (!db) return INFO_ITEMS;
  const snap = await db.collection(INFO_COLLECTION).get();
  if (snap.empty) return INFO_ITEMS;
  return snap.docs.map((doc) => toInfoItem(doc.id, doc.data()));
}

/** 상세 페이지용 단건 조회. Firestore 없으면 시드에서 찾음. */
export async function getInfoItemById(id: string): Promise<InfoItem | undefined> {
  const db = getAdminDb();
  if (!db) return INFO_ITEMS.find((i) => i.id === id);
  const doc = await db.collection(INFO_COLLECTION).doc(id).get();
  if (doc.exists) return toInfoItem(doc.id, doc.data()!);
  return INFO_ITEMS.find((i) => i.id === id);
}

/** 검토 대기(reviewed=false) 항목만 — 보정 화면용. */
export async function listUnreviewedInfoItems(): Promise<InfoItem[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(INFO_COLLECTION).where("reviewed", "==", false).get();
  return snap.docs
    .map((doc) => toInfoItem(doc.id, doc.data()))
    .sort((a, b) => (b.collectedAt ?? "").localeCompare(a.collectedAt ?? ""));
}

/** 교사 보정: 구분·학교급·대상학년 확정 + reviewed:true. */
export async function updateInfoFacets(
  id: string,
  facets: { category?: unknown; level?: unknown; grade?: unknown },
): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  await db.collection(INFO_COLLECTION).doc(id).set(
    {
      category: oneOf(facets.category, CATEGORIES, "etc"),
      level: oneOf(facets.level, LEVELS, "both"),
      grade: oneOf(facets.grade, GRADES, "all"),
      reviewed: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return true;
}
