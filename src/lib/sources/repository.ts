import { FieldValue, type Timestamp } from "firebase-admin/firestore";
import type { DocType, PdfSource, PdfSourceInput, UnivType } from "../domain/types";
import { getAdminDb } from "../firebase/admin";

// 원본 PDF 소스 메타데이터 (Firestore `pdf_sources`). 큰 PDF 자체는 Storage에
// 있고([[uploadOriginal]]), 여기엔 목록·필터·원문링크용 메타만 둔다. 문서 id는
// 대학·연도 기반 안정 식별자(예: skku-2026-susi)를 그대로 doc id로 쓴다.

export const SOURCES_COLLECTION = "pdf_sources";

const DOC_TYPES: DocType[] = [
  "수시모집요강",
  "정시모집요강",
  "전형시행계획",
  "선행학습영향평가보고서",
  "대학별고사자료",
];
const UNIV_TYPES: UnivType[] = ["국립", "공립", "사립"];

function toSource(id: string, d: FirebaseFirestore.DocumentData): PdfSource {
  const createdAt = d.createdAt as Timestamp | undefined;
  return {
    id,
    university: d.university ?? "",
    univType: UNIV_TYPES.includes(d.univType) ? d.univType : "사립",
    region: d.region ?? "",
    isCapitalArea: d.isCapitalArea === true,
    docType: DOC_TYPES.includes(d.docType) ? d.docType : "수시모집요강",
    admissionYear: typeof d.admissionYear === "number" ? d.admissionYear : 0,
    examYear: typeof d.examYear === "number" ? d.examYear : 0,
    targetGrade: d.targetGrade ?? "",
    publishedAt: d.publishedAt ?? "",
    sourceUrl: d.sourceUrl ?? "",
    originalPath: d.originalPath ?? "",
    originalUrl: d.originalUrl ?? "",
    createdAt: createdAt?.toDate().toISOString(),
  };
}

/** 원본 소스 목록 (최신 학년도 우선, 그 안에서 대학명). */
export async function listSources(): Promise<PdfSource[]> {
  const db = getAdminDb();
  if (!db) return [];
  const snap = await db.collection(SOURCES_COLLECTION).get();
  return snap.docs
    .map((doc) => toSource(doc.id, doc.data()))
    .sort(
      (a, b) =>
        b.admissionYear - a.admissionYear ||
        a.university.localeCompare(b.university),
    );
}

export async function getSourceById(id: string): Promise<PdfSource | undefined> {
  const db = getAdminDb();
  if (!db) return undefined;
  const doc = await db.collection(SOURCES_COLLECTION).doc(id).get();
  return doc.exists ? toSource(doc.id, doc.data()!) : undefined;
}

/** 원본 등록/갱신 (id를 doc id로 upsert). Storage 미설정이면 null. */
export async function createSource(input: PdfSourceInput): Promise<string | null> {
  const db = getAdminDb();
  if (!db) return null;
  const { id, ...rest } = input;
  await db
    .collection(SOURCES_COLLECTION)
    .doc(id)
    .set({ ...rest, createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return id;
}
