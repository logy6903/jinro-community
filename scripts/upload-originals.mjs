// docs/요강-metadata.json 에 스테이징된 요강 PDF를 Firebase Storage에 올리고,
// originalPath / publicUrl 을 메타데이터에 되기록한다. (원본 저장 절차 검증용)
import crypto from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(readFileSync(path.join(ROOT, "service-account.json"), "utf8"));
const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  `${sa.project_id}.firebasestorage.app`;

const app = initializeApp({
  credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  storageBucket: bucketName,
});
const bucket = getStorage(app).bucket();

const metaPath = path.join(ROOT, "docs", "요강-metadata.json");
const meta = JSON.parse(readFileSync(metaPath, "utf8"));

for (const it of meta.items) {
  const local = path.join(ROOT, "docs", it.localFile);
  const buf = readFileSync(local);
  const objPath = `originals/${it.id}.pdf`;
  const file = bucket.file(objPath);
  const token = crypto.randomUUID();
  await file.save(buf, {
    resumable: false,
    contentType: "application/pdf",
    metadata: {
      cacheControl: "public, max-age=31536000",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  it.originalPath = objPath;
  it.publicUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/` +
    `${encodeURIComponent(objPath)}?alt=media&token=${token}`;
  console.log(`업로드: ${objPath}  (${Math.round(buf.length / 1024)}KB)`);
}

writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log("✅ 메타데이터에 originalPath/publicUrl 기록 완료");
process.exit(0);
