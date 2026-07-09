// 기존 데이터 소급 채우기(backfill): sourceId는 있는데 sourcePage가 비어 있는
// 데이터셋에, 원본 요강의 그 표가 있던 페이지를 되찾아 넣는다. 재추출·재저장 없이
// Pass 1(표 지도)만 소스당 한 번 돌려 데이터셋 제목 ↔ 표 제목으로 매칭.
//
// 실행(미리보기):  npx tsx scripts/backfill-source-pages.mjs
// 실행(실반영):    npx tsx scripts/backfill-source-pages.mjs --commit
import { readFileSync } from "node:fs";

// .env.local 수동 로드 (ANTHROPIC_API_KEY + FIREBASE_ADMIN_* 필요).
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const COMMIT = process.argv.includes("--commit");

const { listDatasets, updateDatasetSourcePage } = await import(
  "../src/lib/datasets/repository.ts"
);
const { getSourceById } = await import("../src/lib/sources/repository.ts");
const { getAdminBucket } = await import("../src/lib/firebase/admin.ts");
const { mapTables } = await import("../src/lib/extract/pdf.ts");

const norm = (s) => (s ?? "").toLowerCase().replace(/\s+/g, "");

/** 데이터셋 제목에 가장 잘 맞는 표를 고른다. 기본 제목이 "대학명 + 표제목"이라,
 *  표 제목이 데이터셋 제목 안에 통째로 들어가면 강한 매칭(가장 긴 것 우선). */
function matchTable(datasetTitle, tables) {
  const dt = norm(datasetTitle);
  let best = null;
  let bestLen = 0;
  for (const t of tables) {
    const tt = norm(t.title);
    if (!tt) continue;
    const contained = dt.includes(tt) || tt.includes(dt);
    if (contained && tt.length > bestLen) {
      best = t;
      bestLen = tt.length;
    }
  }
  return best;
}

const all = await listDatasets();
const targets = all.filter((d) => d.sourceId && !d.sourcePage);
console.log(
  `전체 ${all.length}건 · 백필 대상(sourceId 있고 sourcePage 없음) ${targets.length}건 · 모드: ${
    COMMIT ? "실반영(--commit)" : "미리보기(dry-run)"
  }`,
);
if (targets.length === 0) process.exit(0);

// 소스별로 묶어 Pass 1을 한 번씩만.
const bySource = new Map();
for (const d of targets) {
  if (!bySource.has(d.sourceId)) bySource.set(d.sourceId, []);
  bySource.get(d.sourceId).push(d);
}

const bucket = getAdminBucket();
if (!bucket) {
  console.error("Storage 미설정 — 원본 PDF를 읽을 수 없습니다. 중단.");
  process.exit(1);
}

let matched = 0;
const unmatched = [];

for (const [sourceId, group] of bySource) {
  const source = await getSourceById(sourceId);
  if (!source || !source.originalPath) {
    console.log(`\n[소스 ${sourceId}] 원본 없음 — 건너뜀 (${group.length}건)`);
    group.forEach((d) => unmatched.push({ id: d.id, title: d.title, why: "원본 없음" }));
    continue;
  }
  console.log(`\n[${source.university} ${source.docType}] 표 지도 추출 중… (${group.length}건 대상)`);
  let tables;
  try {
    const [buf] = await bucket.file(source.originalPath).download();
    const map = await mapTables(buf.toString("base64"));
    tables = map?.tables ?? [];
  } catch (e) {
    console.log(`  표 지도 실패: ${e?.message ?? e}`);
    group.forEach((d) => unmatched.push({ id: d.id, title: d.title, why: "표지도 실패" }));
    continue;
  }
  console.log(`  표 ${tables.length}개 인식.`);

  for (const d of group) {
    const t = matchTable(d.title, tables);
    if (!t) {
      console.log(`  ✗ 매칭 실패: "${d.title}"`);
      unmatched.push({ id: d.id, title: d.title, why: "표 매칭 실패" });
      continue;
    }
    const start = t.page;
    const end = t.endPage && t.endPage > t.page ? t.endPage : t.page;
    console.log(`  ✓ "${d.title}"  →  ${start}${end > start ? `~${end}` : ""}p  (표: ${t.title})`);
    matched++;
    if (COMMIT) await updateDatasetSourcePage(d.id, start, end);
  }
}

console.log(
  `\n결과: 매칭 ${matched}건 · 미매칭 ${unmatched.length}건 · ${
    COMMIT ? "반영 완료" : "미리보기(반영 안 함) — 확인 후 --commit"
  }`,
);
if (unmatched.length) {
  console.log("미매칭(수동 지정 필요):");
  unmatched.forEach((u) => console.log(`  - [${u.why}] ${u.title} (${u.id})`));
}
