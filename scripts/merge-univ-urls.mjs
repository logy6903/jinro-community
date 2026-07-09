// docs/univ-urls.json (에이전트가 찾은 [{university, sourceUrl, note}]) 을
// 대학 메타데이터 테이블과 합쳐 docs/univ-guides.json 에 항목 추가.
// 이미 있는 id는 sourceUrl만 갱신(중복 방지). 수집은 collect-univ-guides.mjs가 담당.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 대학명 → {slug, univType, region, isCapitalArea, docType}
// (사용자 리스트 기반. 과기원은 docType="모집요강", 나머지 "수시모집요강")
const M = {
  // 서울 사립
  "한양대학교": ["hanyang", "사립", "서울", true],
  "중앙대학교": ["cau", "사립", "서울", true],
  "경희대학교": ["khu", "사립", "서울", true],
  "한국외국어대학교": ["hufs", "사립", "서울", true],
  "한국외대": ["hufs", "사립", "서울", true],
  "건국대학교": ["konkuk", "사립", "서울", true],
  "동국대학교": ["dongguk", "사립", "서울", true],
  "홍익대학교": ["hongik", "사립", "서울", true],
  "숭실대학교": ["ssu", "사립", "서울", true],
  "세종대학교": ["sejong", "사립", "서울", true],
  "국민대학교": ["kookmin", "사립", "서울", true],
  "광운대학교": ["kw", "사립", "서울", true],
  "명지대학교": ["mju", "사립", "서울", true],
  "상명대학교": ["smu", "사립", "서울", true],
  "가톨릭대학교": ["catholic", "사립", "서울", true],
  // 여대
  "이화여자대학교": ["ewha", "사립", "서울", true],
  "숙명여자대학교": ["sookmyung", "사립", "서울", true],
  "성신여자대학교": ["sungshin", "사립", "서울", true],
  "덕성여자대학교": ["duksung", "사립", "서울", true],
  "동덕여자대학교": ["dongduk", "사립", "서울", true],
  "서울여자대학교": ["swu", "사립", "서울", true],
  // 경기·인천 사립
  "아주대학교": ["ajou", "사립", "경기", true],
  "인하대학교": ["inha", "사립", "인천", true],
  "가천대학교": ["gachon", "사립", "경기", true],
  "경기대학교": ["kgu", "사립", "경기", true],
  "단국대학교": ["dankook", "사립", "경기", true],
  "한국항공대학교": ["kau", "사립", "경기", true],
  // 거점국립
  "강원대학교": ["kangwon", "국립", "강원", false],
  "충북대학교": ["chungbuk", "국립", "충북", false],
  "충남대학교": ["cnu", "국립", "충남", false],
  "전북대학교": ["jbnu", "국립", "전북", false],
  "전남대학교": ["jnu", "국립", "전남", false],
  "경북대학교": ["knu", "국립", "경북", false],
  "부산대학교": ["pnu", "국립", "부산", false],
  "경상국립대학교": ["gnu", "국립", "경남", false],
  "제주대학교": ["jejunu", "국립", "제주", false],
  // 과기원 (docType 모집요강)
  "UNIST": ["unist", "국립", "울산", false, "모집요강"],
  "GIST": ["gist", "국립", "광주", false, "모집요강"],
  "DGIST": ["dgist", "국립", "대구", false, "모집요강"],
  // 지방 사립
  "울산대학교": ["ulsan", "사립", "울산", false],
  "영남대학교": ["yu", "사립", "경북", false],
  "계명대학교": ["kmu", "사립", "대구", false],
  "동아대학교": ["donga", "사립", "부산", false],
  "인제대학교": ["inje", "사립", "경남", false],
  "조선대학교": ["chosun", "사립", "광주", false],
  "원광대학교": ["wku", "사립", "전북", false],
  "한림대학교": ["hallym", "사립", "강원", false],
};

const guidesPath = path.join(ROOT, "docs", "univ-guides.json");
const urlsPath = path.join(ROOT, "docs", "univ-urls.json");
const guides = JSON.parse(fs.readFileSync(guidesPath, "utf8"));
const urls = JSON.parse(fs.readFileSync(urlsPath, "utf8"));
const byId = new Map(guides.items.map((it) => [it.id, it]));

let added = 0, updated = 0, skipped = 0;
for (const u of urls) {
  const name = u.university.replace(/\s*\(.*?\)\s*/g, "").trim(); // 캠퍼스 접미사 제거
  const meta = M[name] || M[u.university];
  if (!meta) { console.log(`⚠ 메타 없음: ${u.university}`); skipped++; continue; }
  const [slug, univType, region, isCapitalArea, docType = "수시모집요강"] = meta;
  const id = docType === "모집요강" ? `${slug}-2026` : `${slug}-2026-susi`;
  const existing = byId.get(id);
  if (existing) {
    if (u.sourceUrl && existing.sourceUrl !== u.sourceUrl) { existing.sourceUrl = u.sourceUrl; existing.status = undefined; updated++; }
    else skipped++;
    continue;
  }
  const entry = {
    id, university: u.university, univType, region, isCapitalArea, docType,
    admissionYear: 2026, examYear: 2025, targetGrade: "2025년 수능 응시생 (현재 고3)",
    sourceUrl: u.sourceUrl || null,
  };
  if (u.note && /미러|mirror|cdn|비공식/i.test(u.note)) entry.sourceNote = "미러(비공식)";
  guides.items.push(entry);
  byId.set(id, entry);
  added++;
}

fs.writeFileSync(guidesPath, JSON.stringify(guides, null, 2) + "\n");
console.log(`병합: 추가 ${added} · URL갱신 ${updated} · 스킵 ${skipped} → 총 ${guides.items.length}건`);
