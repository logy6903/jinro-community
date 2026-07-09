// 배치 추출: 지정 대학의 요강에서 핵심 표를 뽑아 draft 데이터셋으로 저장.
// AI가 미리 다 뽑아두고(전체 Opus), 교사는 나중에 "딸깍 로드"로 검수·공개만.
// draft로 저장되므로 검수 전엔 챗봇에 노출되지 않는다(게이트).
//
// 실행(대상 확인, 무료):   npx tsx scripts/batch-extract.mjs
// 실행(실추출):           npx tsx scripts/batch-extract.mjs --run [--limit N]
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  const e = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  for (const l of e.split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const RUN = process.argv.includes("--run");
const li = process.argv.indexOf("--limit");
const LIMIT = li >= 0 ? Number(process.argv[li + 1]) : Infinity;

const { listSources } = await import("../src/lib/sources/repository.ts");
const { listDatasets, createDataset } = await import("../src/lib/datasets/repository.ts");
const { mapTables, extractTable } = await import("../src/lib/extract/pdf.ts");
const { extractPageRange } = await import("../src/lib/extract/split.ts");
const { mergeNotes } = await import("../src/lib/extract/merge.ts");
const { getAdminBucket } = await import("../src/lib/firebase/admin.ts");

// 대상: 상위 11개 대학 · 2027학년도 · 수시모집요강. 이름 부분매칭.
const TARGETS = ["서울대", "연세대", "고려대", "성균관대", "서강대", "한양대", "중앙대", "경희대", "외국어대", "시립대", "이화여자대"];
const YEAR = 2027;
// 챗봇이 답할 표만: 기타는 제외(잡표·목차 등). 검수자가 나중에 더 추가 가능.
const SKIP_KIND = "기타";
const MAX_TABLES = 40;

const sources = await listSources();
const rank = (u) => {
  const i = TARGETS.findIndex((t) => u.includes(t));
  return i < 0 ? 999 : i;
};
const targets = sources
  .filter(
    (s) =>
      s.docType === "수시모집요강" &&
      s.admissionYear === YEAR &&
      TARGETS.some((t) => s.university.includes(t)),
  )
  .sort((a, b) => rank(a.university) - rank(b.university));
// 이미 draft가 있는 소스는 건너뜀(재실행 시 중복·재과금 방지).
const existing = await listDatasets();
const doneSourceIds = new Set(existing.filter((d) => d.sourceId).map((d) => d.sourceId));

console.log(`대상 ${targets.length}개 (상위 11개 대학 · ${YEAR} 수시) · 모드: ${RUN ? "실추출" : "미리보기(무료)"}`);
for (const s of targets) {
  const flag = doneSourceIds.has(s.id) ? " [이미 추출됨·건너뜀]" : "";
  console.log(`  - ${s.university} (${s.id})${flag}`);
}
if (!RUN) {
  console.log("\n미리보기입니다 — 실추출은 --run [--limit N]");
  process.exit(0);
}

const bucket = getAdminBucket();
let processed = 0;
for (const s of targets) {
  if (processed >= LIMIT) break;
  if (doneSourceIds.has(s.id)) continue;
  processed++;
  console.log(`\n=== [${processed}] ${s.university} — 표지도(Pass1) ===`);
  let tables;
  try {
    const [buf] = await bucket.file(s.originalPath).download();
    const b64all = buf.toString("base64");
    const map = await mapTables(b64all);
    tables = (map?.tables ?? []).filter((t) => t.kind !== SKIP_KIND).slice(0, MAX_TABLES);
    console.log(`  인식 ${map?.tables.length ?? 0}개 → 추출대상(기타 제외) ${tables.length}개`);

    let saved = 0;
    for (const t of tables) {
      const start = t.page;
      const end = t.endPage && t.endPage > start ? t.endPage : start;
      try {
        const sub = await extractPageRange(buf, start, end);
        const ex = await extractTable(sub.toString("base64"), { title: t.title, page: 1 });
        if (!ex || ex.columns.length === 0) {
          console.log(`  ✗ ${start}p ${t.title.slice(0, 24)} — 추출 실패/빈표`);
          continue;
        }
        const merged = mergeNotes({ columns: ex.columns, rows: ex.rows, notes: ex.notes, confidence: ex.confidence });
        const id = await createDataset(
          {
            envelope: {
              title: `${s.university} ${t.title}`,
              category: "admission",
              schoolLevel: "high",
              year: String(s.admissionYear),
              source: `${s.university} ${s.docType}`,
              customFields: merged.customFields,
            },
            columns: merged.columns,
            rows: merged.rows,
            totalRows: merged.rows.length,
            sourceId: s.id,
            originalUrl: s.originalUrl,
            sourcePage: start,
            sourceEndPage: end,
            status: "draft",
          },
          { uid: "batch-ai", name: "AI 추출(검수 대기)" },
        );
        saved += id ? 1 : 0;
        console.log(`  ✓ ${start}p ${t.title.slice(0, 24)} — ${merged.columns.length}열×${merged.rows.length}행 (확신도 ${Math.round((ex.confidence ?? 0) * 100)}%)`);
      } catch (e) {
        console.log(`  ✗ ${start}p ${t.title.slice(0, 24)} — ${(e?.message ?? e).toString().slice(0, 80)}`);
      }
    }
    console.log(`  → 저장 ${saved}개 (draft)`);
  } catch (e) {
    console.log(`  소스 실패: ${(e?.message ?? e).toString().slice(0, 120)}`);
  }
}
console.log(`\n완료: ${processed}개 대학 처리. draft로 저장됨(검수 전 챗봇 미노출).`);
process.exit(0);
