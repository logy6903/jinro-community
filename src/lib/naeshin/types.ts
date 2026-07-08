// 내신(학생부 정량) 산출 엔진의 타입.
//
// 설계(합의): 대학별 수식을 "패턴 + 파라미터"로 데이터화한다. 조합 규칙은 유한한
// 패턴(가중평균형 등)이고, 대학마다 다른 건 파라미터(환산표·반영교과·반영비)뿐.
// 엔진은 결정론적이고 "관찰가능"하다 — 최종 점수만이 아니라 단계별 중간값(trace)을
// 반환해, QA 화면이 어느 단계에서 어긋나는지 자동으로 짚을 수 있게 한다.
// LLM은 이 수식을 계산하지 않는다(파라미터 추출만). 계산은 이 엔진이 한다.

/** 조합 패턴. 지금은 가중평균형 하나(성대 학교장추천 정량). 늘면 유니온에 추가. */
export type NaeshinPattern = "weighted_average";

/** 한 군(예: A군/B군)의 채점 규칙. */
export interface GroupSpec {
  /** 군 식별자 ("A" | "B" 등). */
  key: string;
  /** 반영교과 설명(사람용). */
  name: string;
  /** 석차등급(1~9) → 반영점수. index 0 = 1등급 … index 8 = 9등급. */
  gradeScore: number[];
  /** 반영비 (1차점수에 곱함). 예: A군 7, B군 1. */
  reflectRatio: number;
}

/** 한 대학·전형의 내신 정량 산출 사양(파라미터 묶음). */
export interface NaeshinSpec {
  /** 안정 식별자 (예: skku-2026-hakjang). */
  id: string;
  university: string;
  /** 전형 (예: 학생부교과(학교장추천)). */
  track: string;
  pattern: NaeshinPattern;
  groups: GroupSpec[];
  /** 총점(만점) — 검증·표시용. Σ(군 만점 × 반영비). */
  maxScore: number;
  /** 출처 요강 소스 id (PdfSource). 추출 자동화 시 물림. */
  sourceId?: string;
}

/**
 * 학생 성적표의 한 과목. group은 이 과목이 속한 군("A"|"B"|"none"=미반영).
 * 과목→군 분류는 상류(추출·입력)의 몫이고, 엔진은 분류된 입력을 받는다.
 */
export interface TranscriptSubject {
  name: string;
  group: string;
  /** 석차등급 1~9. */
  grade: number;
  /** 이수학점(단위). */
  units: number;
}

// ── 결과 + 트레이스(관찰가능) ──────────────────────────────────

export interface SubjectTrace {
  name: string;
  grade: number;
  /** 환산표로 매긴 반영점수. */
  score: number;
  units: number;
}

export interface GroupTrace {
  key: string;
  name: string;
  subjects: SubjectTrace[];
  /** Σ(반영점수 × 단위). */
  sumWeighted: number;
  /** Σ단위. */
  sumUnits: number;
  /** 1차점수 = sumWeighted / sumUnits. */
  firstScore: number;
  reflectRatio: number;
  /** 군 최종 = 1차점수 × 반영비. */
  finalScore: number;
}

export interface NaeshinResult {
  specId: string;
  /** 총점 = Σ 군 최종. */
  total: number;
  groups: GroupTrace[];
  /** 계산에 쓰이지 않은(미반영) 과목명 — 검토 신호. */
  ignored: string[];
}
