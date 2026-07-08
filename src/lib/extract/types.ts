// 요강 PDF 다단 추출 리더의 타입.
//
// 왜 다단인가: 요강 표는 병합셀·중첩헤더(논리적 3~4차원을 2차원에 욱여넣음)라
// 통짜로 읽으면 값 귀속이 틀린다. 그래서 ① 먼저 "표 지도"만 만들고(Pass 1),
// ② 표를 하나씩 페이지 범위로 좁혀 정밀 추출한다(Pass 2). 물리적으로 자르지
// 않는 이유: 주석(※)이 표 바깥에 있어 잘라내면 조건이 사라지기 때문. 그래서
// 격리는 "이 페이지의 이 표만"이라는 지시로 하고, 페이지 전체를 시야에 둔다.

/** 표의 성격 추정 (하드코딩 규칙 아님 — 라우팅 힌트일 뿐). */
export type TableKind =
  | "모집인원"
  | "반영비율"
  | "최저기준"
  | "환산점수"
  | "일정"
  | "기타";

/** Pass 1 — 표 지도의 한 항목. "정확히 읽기"가 아니라 "어디에 표가 있나"만. */
export interface TableMapEntry {
  /** 클라이언트가 붙이는 안정 식별자 (지도 순서 기반). */
  id: string;
  /** 짧은 한국어 라벨. */
  title: string;
  /** 1-based 시작 페이지. */
  page: number;
  /** 여러 페이지에 걸친 표의 마지막 페이지. 단일 페이지면 생략(=page). */
  endPage?: number;
  /** 성격 추정. */
  kind: TableKind;
  /** ※/주)/각주 등 표 바깥 주석이 딸려 있는가. */
  hasNotes: boolean;
  /** 위치 힌트 (예: "3페이지 상단"). */
  location: string;
}

export interface TableMap {
  tables: TableMapEntry[];
  /** 모델이 파악한 총 페이지(선택). */
  pageCount?: number;
}

/**
 * 표 바깥 주석 = "조건". 절대 버리지 않는다. 조건 없는 행은 정답이 아니라 거짓
 * (예: "최저 3합 5 ※단 인문계열만"에서 단서를 빼면 자연계열엔 오답).
 */
export interface ExtractedNote {
  /** 참조 마커 (예: "2)", "*", "※"). 없으면 빈 문자열. */
  marker: string;
  /** 주석 원문. */
  text: string;
  /** 어느 행/칸에 걸리는지 서술. 표 전체면 빈 문자열. */
  appliesTo: string;
}

/**
 * Pass 2 — 표 하나의 정밀 추출 결과. 종이 그리드를 흉내내지 않고 정규화
 * (롱포맷): 병합/중첩을 다 풀어 논리 축마다 열을 만든다.
 */
export interface ExtractedTable {
  columns: string[];
  rows: string[][];
  notes: ExtractedNote[];
  /** 0~1. 병합셀 등으로 불확실하면 낮춘다. 교사 검증 우선순위 신호. */
  confidence: number;
}
