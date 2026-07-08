import crypto from "node:crypto";
import { getAdminBucket } from "../firebase/admin";

// 큰 원본 파일(요강 PDF 등)은 Firestore(문서당 1MB 상한)가 아니라 Firebase
// Storage 버킷에 둔다. Firestore에는 여기서 반환한 path/url 만 기록한다.
//   Storage:  originals/{id}.{ext}   ← 원본
//   Firestore: … originalPath, originalUrl  ← 경로만

export interface StoredOriginal {
  /** 버킷 내 경로 (Firestore에 originalPath로 저장). */
  path: string;
  /** 공개 열람 URL ("원문 PDF 보기" 링크). */
  url: string;
  size: number;
}

/** 원본을 Storage에 저장하고 공개 열람 URL을 돌려준다.
 * Storage 미설정 시 null (호출부가 우아하게 처리). */
export async function uploadOriginal(
  id: string,
  buffer: Buffer,
  opts: { ext?: string; contentType?: string } = {},
): Promise<StoredOriginal | null> {
  const bucket = getAdminBucket();
  if (!bucket) return null;

  const ext = (opts.ext ?? "pdf").replace(/^\./, "");
  const path = `originals/${id}.${ext}`;
  const file = bucket.file(path);

  // Firebase 다운로드 토큰: uniform bucket-level access 에서도 동작하고 URL이
  // 만료되지 않는다(makePublic 은 uniform 버킷에서 실패). 토큰을 아는 사람만 열람.
  const token = crypto.randomUUID();
  await file.save(buffer, {
    resumable: false,
    contentType: opts.contentType ?? "application/pdf",
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });

  return {
    path,
    url:
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
      `${encodeURIComponent(path)}?alt=media&token=${token}`,
    size: buffer.length,
  };
}

/** 원본 삭제(교체·정리용). */
export async function deleteOriginal(path: string): Promise<boolean> {
  const bucket = getAdminBucket();
  if (!bucket) return false;
  await bucket.file(path).delete({ ignoreNotFound: true });
  return true;
}
