// 기존 코퍼스(직전 학년도 항목)에서 이번 시즌(season.mjs의 ADMISSION_YEAR) 항목을
// 나란히 추가한다. 직전 항목은 건드리지 않음(역사 보존 + 타 세션 추출물 보호).
//   - 각 대학의 cdn013 미러에 이번 학년도 요강이 있으면 → sourceUrl=미러, 수집 대기.
//   - 없으면 → sourceUrl=null, status="pending"(별도 재발굴 필요; 17곳 등).
// 실제 다운로드/업로드는 collect-univ-guides.mjs(all)가 담당.
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADMISSION_YEAR, EXAM_YEAR, TARGET_GRADE, mirrorUrl, makeId } from "./season.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = path.join(ROOT, "docs", "univ-guides.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

const PREV = ADMISSION_YEAR - 1; // 직전 학년도(2026)
const slugOf = (id) => id.replace(new RegExp(`-${PREV}(-susi)?$`), "");
const byId = new Map(meta.items.map((it) => [it.id, it]));

function probePdf(url) {
  return new Promise((res) => {
    let u; try { u = new URL(url).href; } catch { return res(false); }
    const req = https.get(u, { rejectUnauthorized: false, headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
      if (r.statusCode !== 200) { r.resume(); return res(false); }
      let n = 0, head = Buffer.alloc(0);
      r.on("data", (c) => { if (head.length < 5) head = Buffer.concat([head, c]).slice(0, 5); n += c.length; });
      r.on("end", () => res(head.toString("latin1").startsWith("%PDF") && n >= 300 * 1024));
    });
    req.on("error", () => res(false));
    req.setTimeout(25000, () => { req.destroy(); res(false); });
  });
}

// 이번 시즌 항목이 없는 직전-학년도 항목만 대상
const prevItems = meta.items.filter((it) => it.admissionYear === PREV);
let added = 0, mirror = 0, pending = 0;

for (const prev of prevItems) {
  const slug = slugOf(prev.id);
  const newId = makeId(slug, prev.docType, ADMISSION_YEAR);
  if (byId.has(newId)) continue; // 이미 있음
  const url = mirrorUrl(prev.university, ADMISSION_YEAR);
  const hasMirror = prev.docType === "수시모집요강" && (await probePdf(url));
  const entry = {
    id: newId,
    university: prev.university,
    univType: prev.univType,
    region: prev.region,
    isCapitalArea: prev.isCapitalArea,
    docType: prev.docType,
    admissionYear: ADMISSION_YEAR,
    examYear: EXAM_YEAR,
    targetGrade: TARGET_GRADE,
  };
  if (prev.bellwether) entry.bellwether = true;
  if (hasMirror) {
    entry.sourceUrl = url;
    entry.sourceNote = "미러(비공식)";
    entry.status = "queued";
    mirror++;
  } else {
    entry.sourceUrl = null;
    entry.status = "pending";
    entry.note = `${ADMISSION_YEAR}학년도 URL 재발굴 필요(미러 미보유)`;
    entry.prevUrl = prev.sourceUrl || null; // 참고: 직전 학년도 출처(연도 치환 힌트)
    pending++;
  }
  meta.items.push(entry);
  byId.set(newId, entry);
  added++;
  console.log(`${hasMirror ? "🪞" : "⏳"} ${prev.university} → ${newId}`);
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log(`\n=== ${ADMISSION_YEAR}학년도 항목 추가: ${added} (미러 ${mirror} · 대기 ${pending}) → 총 ${meta.items.length}건 ===`);
