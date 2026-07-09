// 요강 수집 "시즌"(대입 학년도) 파라미터 — 매년 여기 한 곳만 바꾸면 됨.
//   admissionYear: 학년도(=입학년). examYear: 그 수능이 치러지는 해(=학년도-1).
//   현 고3 대상 = 최신 요강. 2027학년도 = 2026년 11월 수능 = 2026.9월 수시 원서.
export const ADMISSION_YEAR = 2027;
export const EXAM_YEAR = ADMISSION_YEAR - 1;
export const TARGET_GRADE = `${EXAM_YEAR}년 수능 응시생 (현재 고3)`;

// 대성 입시 CDN(cdn013.negagea.net) 미러: 게시판형 입학처의 직PDF 대체재.
//   경로의 univ_info{YEAR}에서 YEAR = 데이터 취합연도 = admissionYear-1(=examYear).
//   파일명은 "{한글명}_{admissionYear}학년도_수시모집요강.pdf".
const MIRROR_BASE = "https://cdn013.negagea.net/dgsmidc/omr/seoul/web";
export function mirrorUrl(universityName, admissionYear = ADMISSION_YEAR) {
  const nm = universityName.replace(/\s*\(.*?\)\s*/g, "").trim(); // 캠퍼스 접미사 제거
  const folder = `univ_info${admissionYear - 1}`;
  const file = `${nm}_${admissionYear}학년도_수시모집요강.pdf`;
  return `${MIRROR_BASE}/${folder}/${encodeURIComponent(nm)}/${encodeURIComponent(file)}`;
}

// id 규칙: {slug}-{admissionYear}[-susi]. 과기원 등 docType="모집요강"은 -susi 없음.
export function makeId(slug, docType, admissionYear = ADMISSION_YEAR) {
  return docType === "모집요강" ? `${slug}-${admissionYear}` : `${slug}-${admissionYear}-susi`;
}
