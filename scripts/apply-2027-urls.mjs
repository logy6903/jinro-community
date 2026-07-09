// docs/univ-urls-2027.json ([{university, url, confirmedYear, evidence}]) 의 URL을
// 이번 시즌(2027) 항목의 sourceUrl에 적용. 실제 수집/업로드는 collect-univ-guides.mjs(all).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADMISSION_YEAR } from "./season.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guidesPath = path.join(ROOT, "docs", "univ-guides.json");
const urlsPath = path.join(ROOT, "docs", "univ-urls-2027.json");
const guides = JSON.parse(fs.readFileSync(guidesPath, "utf8"));
const urls = JSON.parse(fs.readFileSync(urlsPath, "utf8"));

const norm = (s) => s.replace(/\s*\(.*?\)\s*/g, "").replace(/\s+/g, "").trim();
const cur = guides.items.filter((it) => it.admissionYear === ADMISSION_YEAR);
const byNorm = new Map(cur.map((it) => [norm(it.university), it]));

let applied = 0, miss = 0;
for (const u of urls) {
  if (!u.url) { console.log(`· ${u.university}: url 없음(발굴실패) — 건너뜀`); miss++; continue; }
  const it = byNorm.get(norm(u.university));
  if (!it) { console.log(`⚠ 매칭 실패: ${u.university}`); miss++; continue; }
  it.sourceUrl = u.url.replace(/&amp;/g, "&"); // HTML 엔티티 정리
  it.sourceNote = /negagea/i.test(it.sourceUrl) ? "미러(비공식)" : "공식";
  delete it.note; delete it.prevUrl;
  if (it.status === "fail" || it.status === "pending") it.status = "queued";
  console.log(`✅ ${u.university} → ${it.id} (${u.confirmedYear || "?"})`);
  applied++;
}

fs.writeFileSync(guidesPath, JSON.stringify(guides, null, 2) + "\n");
console.log(`\n=== 적용 ${applied} · 미적용 ${miss} ===`);
