import type { DatasetCategory } from "../domain/types";

// 봉투 customFields의 "분류 태그" 표준 어휘. 목적은 검수자들이 같은 뜻을 같은
// 말로 적게 해 챗봇 라우팅·비교를 안전하게 하는 것 — 특히 입결처럼 "이 숫자가
// 무엇인지"(지표·기준)를 반드시 붙이도록. enum(하드코딩)이 아니라 '제안'이다:
// 값은 자유롭게 벗어날 수 있고, datalist 자동완성으로 수렴만 유도한다.

export interface TagSpec {
  key: string;
  /** 흔한 값 후보(자동완성). 이 밖의 값도 허용. */
  values: string[];
  /** 왜 필요한지 한 줄(검수자 힌트). */
  hint?: string;
}

/** 카테고리별 권장 태그. 없는 카테고리는 자유 태그만. */
export const TAG_SPECS: Partial<Record<DatasetCategory, TagSpec[]>> = {
  // 입시결과(입결) — 지표 정의가 대학마다 달라, 지표·기준을 안 붙이면 비교 불가.
  result: [
    {
      key: "지표",
      values: ["70%컷", "50%컷", "85%컷", "90%컷", "평균", "최고", "최저", "분포구간"],
      hint: "이 숫자가 무엇인지 (컷/평균 혼동 방지)",
    },
    { key: "기준", values: ["최종등록자", "합격자", "지원자"], hint: "누구 기준 성적인지" },
    { key: "단위", values: ["등급", "백분위", "환산점수", "표준점수"] },
    { key: "출처유형", values: ["대학자체", "어디가(대교협)"], hint: "정의가 달라 섞으면 위험" },
    {
      key: "전형구분",
      values: ["학생부교과", "학생부종합", "논술", "실기실적", "정시 가군", "정시 나군", "정시 다군"],
    },
  ],
  // 모집요강·전형(입시·전형).
  admission: [
    { key: "전형유형", values: ["학생부교과", "학생부종합", "논술", "실기실적", "정시"] },
    { key: "반영요소", values: ["교과", "서류", "면접", "논술", "수능", "실기"] },
    { key: "수능최저", values: ["있음", "없음"] },
    { key: "계열", values: ["인문", "자연", "예체능", "통합"] },
  ],
  // 논술.
  essay: [
    { key: "과목", values: ["인문논술", "수리논술", "과학논술"] },
    { key: "수능최저", values: ["있음", "없음"] },
  ],
};

/** 자동완성용: 해당 카테고리의 권장 키 목록(없으면 빈 배열). */
export function suggestedKeys(category: DatasetCategory): string[] {
  return (TAG_SPECS[category] ?? []).map((s) => s.key);
}

/** 자동완성용: 키에 대한 권장 값 목록(카테고리 무관, 전 카테고리에서 수집). */
export function suggestedValues(category: DatasetCategory, key: string): string[] {
  const specs = TAG_SPECS[category] ?? [];
  const hit = specs.find((s) => s.key === key);
  return hit ? hit.values : [];
}
