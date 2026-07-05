// Generate recommended .xlsx templates into public/templates/.
//
//   npm run templates
//
// Each template is a flat "한 행 = 한 단위, 속성은 열" table (header + one example
// row) — the shape the chatbot compares/filters best. Teachers download, fill,
// and upload via /datasets/new. Regenerate by editing TEMPLATES and re-running.

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as XLSX from "xlsx";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "templates");
mkdirSync(OUT, { recursive: true });

const TEMPLATES = [
  {
    file: "admission.xlsx",
    headers: ["대학", "전형명", "모집단위", "모집인원", "전형방법", "수능최저", "비고"],
    example: ["○○대", "학생부종합", "컴퓨터공학과", "30", "서류100%", "없음", ""],
  },
  {
    file: "essay.xlsx",
    headers: ["대학", "모집단위", "모집인원", "논술유형", "수능최저", "시험일", "출처"],
    example: ["○○대", "의예과", "40", "수리논술", "4합5", "2026-11-23", "○○대 입학처"],
  },
  {
    file: "career.xlsx",
    headers: ["직업·분야", "관련학과", "필요역량", "자격·자격증", "추천활동", "진출경로", "출처"],
    example: ["데이터분석가", "통계학과/컴퓨터공학과", "통계·프로그래밍", "ADsP", "교내 데이터 동아리", "기업 데이터팀", ""],
  },
];

for (const t of TEMPLATES) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([t.headers, t.example]);
  XLSX.utils.book_append_sheet(wb, ws, "데이터");
  XLSX.writeFile(wb, path.join(OUT, t.file));
  console.log(`  ✓ public/templates/${t.file}`);
}
console.log(`\n${TEMPLATES.length}개 템플릿 생성 완료.`);
process.exit(0);
