// docs/univ-guides.json (요강 코퍼스 매니페스트) → Firestore pdf_sources 일괄 등록/갱신.
// 배경: 스토리지엔 PDF가 올라갔지만 pdf_sources 레코드가 없어 작업대(PdfBrowser)에
// 안 보이는 상태를 해소한다. createSource가 id로 upsert(merge)라 재실행 안전(멱등).
//
// 실행(미리보기):  npx tsx scripts/seed-sources-from-guides.mjs
// 실행(실반영):    npx tsx scripts/seed-sources-from-guides.mjs --commit
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env.local 로드(스토리지 버킷명 등). 크레덴셜은 루트 service-account.json 자동 인식.
try {
  const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const COMMIT = process.argv.includes("--commit");
const { createSource } = await import("../src/lib/sources/repository.ts");
const { getAdminBucket } = await import("../src/lib/firebase/admin.ts");

const manifest = JSON.parse(
  readFileSync(path.join(ROOT, "docs", "univ-guides.json"), "utf8"),
);
const items = manifest.items ?? [];

// 스토리지 실제 파일 집합(원본 존재 확인).
const bucket = getAdminBucket();
let have = new Set();
if (bucket) {
  const [files] = await bucket.getFiles({ prefix: "originals/" });
  have = new Set(files.map((f) => f.name));
}

let target = 0, skipStatus = 0, skipNoFile = 0, seeded = 0;
const problems = [];
for (const it of items) {
  if (it.status && it.status !== "ok") {
    skipStatus++;
    problems.push(`status=${it.status}: ${it.id}`);
    continue;
  }
  if (!it.originalPath) {
    skipNoFile++;
    problems.push(`originalPath 없음: ${it.id}`);
    continue;
  }
  if (bucket && !have.has(it.originalPath)) {
    skipNoFile++;
    problems.push(`스토리지에 파일 없음: ${it.id}`);
    continue;
  }
  target++;
  if (COMMIT) {
    const id = await createSource({
      id: it.id,
      university: it.university,
      univType: it.univType,
      region: it.region,
      isCapitalArea: !!it.isCapitalArea,
      docType: it.docType,
      admissionYear: it.admissionYear,
      examYear: it.examYear,
      targetGrade: it.targetGrade ?? "",
      publishedAt: it.publishedAt ?? "",
      sourceUrl: it.sourceUrl ?? "",
      originalPath: it.originalPath,
      originalUrl: it.publicUrl ?? it.originalUrl ?? "",
    });
    if (id) seeded++;
  }
}

console.log(
  `매니페스트 ${items.length}개 · 등록대상 ${target} · status제외 ${skipStatus} · 파일없음제외 ${skipNoFile}`,
);
if (problems.length) {
  console.log("제외 상세:");
  problems.slice(0, 20).forEach((p) => console.log("  -", p));
}
console.log(
  COMMIT ? `✅ pdf_sources 반영: ${seeded}건` : "미리보기(반영 안 함) — 확인 후 --commit",
);
process.exit(0);
