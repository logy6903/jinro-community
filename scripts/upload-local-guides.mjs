// 브라우저로만 받아지는 대학(KAIST·UNIST·인제·조선)을 직접 받아
// docs/local/{id}.pdf 로 넣어두면, Storage 업로드 + univ-guides.json 갱신.
//   파일명(확장자 제외) = univ-guides.json 의 id. 예: docs/local/kaist-2026.pdf
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, "service-account.json"), "utf8"));
const app = initializeApp({
  credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${sa.project_id}.firebasestorage.app`,
});
const bucket = getStorage(app).bucket();

const localDir = path.join(ROOT, "docs", "local");
const metaPath = path.join(ROOT, "docs", "univ-guides.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const byId = new Map(meta.items.map((it) => [it.id, it]));

if (!fs.existsSync(localDir)) { console.log(`${localDir} 없음 — PDF를 넣어주세요`); process.exit(0); }
const files = fs.readdirSync(localDir).filter((f) => /\.pdf$/i.test(f));
if (!files.length) { console.log("docs/local/에 PDF 없음"); process.exit(0); }

for (const f of files) {
  const id = f.replace(/\.pdf$/i, "");
  const it = byId.get(id);
  if (!it) { console.log(`⚠ univ-guides.json에 id 없음: ${id} (파일명을 id로 맞춰주세요)`); continue; }
  const buf = fs.readFileSync(path.join(localDir, f));
  if (!buf.slice(0, 5).toString("latin1").startsWith("%PDF")) { console.log(`⚠ PDF 아님: ${f}`); continue; }
  const objPath = `originals/${id}.pdf`;
  const token = it.downloadToken || crypto.randomUUID();
  await bucket.file(objPath).save(buf, {
    resumable: false, contentType: "application/pdf",
    metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
  });
  it.originalPath = objPath;
  it.downloadToken = token;
  it.publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objPath)}?alt=media&token=${token}`;
  it.contentHash = crypto.createHash("sha256").update(buf).digest("hex");
  it.sizeMB = +(buf.length / 1048576).toFixed(1);
  it.status = "ok";
  it.sourceNote = "직접 다운로드(브라우저 필요 사이트)";
  delete it.note;
  console.log(`✅ ${it.university}: ${it.sizeMB}MB 업로드`);
}
fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log("완료 — univ-guides.json 갱신됨");
process.exit(0);
