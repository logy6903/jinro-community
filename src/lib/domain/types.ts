// Core domain model for the 진로교사 커뮤니티.
//
// Design note: per the project plan, certification-track-style hardcoding is
// avoided. Academic periods and the cards that map to them are treated as
// DATA (see calendar/academicCalendar.ts, content/cards.ts), not as enums
// baked into logic. The calendar engine reads these tables to decide what to
// surface "this week".

/** 중학교 / 고등학교 — content and screens are split from the start. */
export type SchoolLevel = "middle" | "high";

/** The kind of share-unit a card is. */
export type CardCategory = "activity" | "lesson" | "info" | "checklist";

/**
 * Stable id of an academic period (a "calendar tag"). Cards reference these.
 * The special tag "evergreen" means the card is always applicable.
 */
export type CalendarTag = string;

export const EVERGREEN: CalendarTag = "evergreen";

export interface Attachment {
  name: string;
  url: string;
}

/**
 * A single share-unit. Everything a teacher can drop into a 단톡방 as one link.
 * Viewable without login; attribution to I&AI is rendered at the end.
 */
export interface ContentCard {
  id: string;
  schoolLevel: SchoolLevel;
  category: CardCategory;
  title: string;
  /** One-line hook shown on the card face. */
  summary: string;
  /** Body as plain-text paragraphs (split on blank lines). No markdown. */
  body: string;
  /** Periods this card belongs to. Include EVERGREEN for always-on cards. */
  calendarTags: CalendarTag[];
  /** Where it came from / who made it. */
  source: string;
  attachments?: Attachment[];
  /**
   * "실제 수업에 사용함" — field-validation signal, deliberately ranked above
   * likes. Persistence is Phase 2 (DB); seed values are editorial estimates.
   */
  usedCount: number;
}

/**
 * One row of the academic calendar. The engine activates a period when today
 * falls within [start, end] (inclusive, MM-DD). This is the "manual tagging"
 * minimum viable version of the calendar rule table from the plan.
 */
export interface AcademicPeriod {
  id: CalendarTag;
  level: SchoolLevel;
  /** UI label (Korean). */
  label: string;
  /** What teachers at this level are typically doing now. */
  hint: string;
  /** Inclusive MM-DD bounds. If start > end, the range wraps the year end. */
  start: string; // "MM-DD"
  end: string; // "MM-DD"
}

/**
 * A teacher-contributed material on the 자료 공유 게시판. Distinct from
 * ContentCard (editorial, calendar-curated) — these have an author and their
 * own lifecycle. Viewable without login; posting requires login.
 */
export interface SharedMaterial {
  id: string;
  authorUid: string;
  authorName: string;
  schoolLevel: SchoolLevel;
  category: CardCategory;
  title: string;
  summary: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
  /** "실제 수업에 사용함" count (per-teacher dedup, same pattern as cards). */
  usedCount: number;
}

/** Fields a teacher submits when creating a material (server fills the rest). */
export interface NewMaterialInput {
  schoolLevel: SchoolLevel;
  category: CardCategory;
  title: string;
  summary: string;
  body: string;
}

/**
 * An auto-collected external info item (정책/입시/공모전 등). Populated by the
 * collect script from RSS sources (ported from kakao-daily), read-only in the
 * app. Loose coupling: this app owns its own external_feed; it does not share
 * kakao-daily's storage.
 */
export interface ExternalFeedItem {
  /** Stable id (hash of url) for dedup. */
  id: string;
  source: string;
  title: string;
  url: string;
  /** ISO timestamp of publication (sorts lexically = chronologically). */
  publishedAt: string;
  /** ISO timestamp this item was collected. */
  collectedAt: string;
}

// ── 데이터셋(엑셀 업로드) ──────────────────────────────────────
// "봉투"(메타데이터) + "내용물"(엑셀 행). 봉투만 형식 고정, 열은 자유.
// 챗봇이 봉투로 데이터셋을 찾고, 행을 근거로 답한다.

export type DatasetCategory =
  | "admission" // 입시·전형
  | "essay" // 논술
  | "record" // 학생부·세특
  | "interview" // 면접
  | "result" // 입결·경쟁률
  | "career" // 진로·직업
  | "activity" // 체험·활동
  | "contest" // 공모전
  | "etc"; // 기타

/** 데이터셋 적용 대상. 자료가 중·고 공통일 수 있어 "both" 허용. */
export type DatasetLevel = SchoolLevel | "both";

/** 봉투의 자유 추가 항목 (핵심칸 위에 얹는 선택 태그). 파일 전체 속성용. */
export interface CustomField {
  key: string;
  value: string;
}

/** 업로드 시 교사가 채우는 "봉투"(서버가 작성자·날짜를 채움). */
export interface DatasetEnvelope {
  title: string;
  category: DatasetCategory;
  schoolLevel: DatasetLevel;
  /** 학년도/시기 (자유 텍스트, 예: "2027"). */
  year: string;
  source: string;
  /** 교사가 추가한 자유 태그 (라우팅은 핵심칸이 담당, 이건 보조 신호). */
  customFields: CustomField[];
}

/** 봉투 + 내용물(헤더 행 = columns, 데이터 행 = rows). */
export interface Dataset extends DatasetEnvelope {
  id: string;
  authorUid: string;
  authorName: string;
  /** 엑셀 헤더 행. */
  columns: string[];
  /** 데이터 행들 (저장 상한까지). */
  rows: string[][];
  /** 실제 총 행 수 (상한 초과 시 rows.length보다 클 수 있음). */
  rowCount: number;
  createdAt: string;
}

// ── 진로 일정표 ─────────────────────────────────────────────
// 두 축 중 "일정표": 화면 캘린더로 한눈에. 공용 일정(I&AI 기본, academicCalendar에서
// 파생)이 자동으로 깔리고, 그 위에 교사가 학교 일정을 얹는다. 진로교사는 학교당 1명
// 이라 교사별 소유 = 그 학교 일정 (학교 그룹핑 불필요). 각 일정은 수업 힌트를 단다.

export type ScheduleOrigin = "common" | "teacher";

export interface ScheduleItem {
  id: string;
  level: DatasetLevel; // middle | high | both
  title: string;
  /** 툴팁용 수업 힌트 ("이 시기엔 ~수업 필요"). */
  hint: string;
  /** 적용 기간 (MM-DD). 단일일은 start==end. 연말 넘김 허용(start>end). */
  start: string;
  end: string;
  origin: ScheduleOrigin;
  /** teacher origin일 때 소유 교사. */
  authorUid?: string;
}

/** 교사가 학교 일정을 추가할 때 보내는 입력. */
export interface ScheduleInput {
  level: DatasetLevel;
  title: string;
  hint: string;
  start: string; // MM-DD
  end: string; // MM-DD
}

// ── 정보 아이템(생성 정보의 통합 노출 단위) ──────────────────────
// kakao-daily가 만든 자료(원문/소식/해설/데이터)를 정보 페이지에서
// 6축 facet으로 필터 브라우징하기 위한 모델. 구분(category)과 학교급
// (level)은 Dataset의 축을 그대로 재사용해 챗봇/데이터와 어휘를 통일.

/** 정보의 성격 4종. */
export type InfoType = "source" | "briefing" | "explainer" | "data";
// source=원문자료(파일), briefing=소식·브리핑, explainer=해설·연재, data=구조화표

/** 대상 학년. 중등은 학년 세분 없이 묶고, 고는 학년별, all=전학년. */
export type InfoGrade = "middle" | "h1" | "h2" | "h3" | "all";

/** 시기 성격. 달력 엔진의 "지금 시기"와 연동되는 보조 축. */
export type InfoTiming = "recent" | "period" | "evergreen";
// recent=최신, period=지금 학사시기, evergreen=상시

/** 정보 페이지의 필터 대상 6축을 담은 노출 단위. */
export interface InfoItem {
  id: string;
  /** 축1: 유형. */
  type: InfoType;
  /** 축2: 구분 — Dataset의 9종을 재사용. */
  category: DatasetCategory;
  /** 축3: 학교급 — 중/고/공통. */
  level: DatasetLevel;
  /** 축4: 대상 학년. */
  grade: InfoGrade;
  /** 축5: 출처(기관) — 신뢰 신호. */
  source: string;
  /** 축6: 시기. */
  timing: InfoTiming;
  title: string;
  summary: string;
  /** 원문/상세 링크 (Drive 원문, 외부 URL, 또는 앱 내부 경로). */
  url: string;
  /** 발행일 ISO(YYYY-MM-DD). 사전식 정렬 = 시간순. */
  publishedAt: string;
  /**
   * 구분·학교급·대상학년이 사람 검토를 거쳤는지. AI가 자동 태깅한 직후엔
   * false(검토 대기), 교사가 확인·수정하면 true. 시드/수기 항목은 생략(=검토됨 취급).
   */
  reviewed?: boolean;
  /** 수집·적재 시각 ISO. */
  collectedAt?: string;
}
