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
  /** 다운로드용 첨부 파일(Storage 토큰 URL). 없으면 텍스트 자료. */
  attachments?: Attachment[];
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
  /** 미리 업로드해 받은 첨부 {name,url} 목록 (URL은 서버가 자기 Storage만 허용). */
  attachments: Attachment[];
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

/**
 * 검수·공개 상태. "검수 후 공개" 원칙을 데이터로 강제하는 스위치.
 * 챗봇은 published(+legacy=필드 없음)만 노출하고 draft는 감춘다.
 */
export type DatasetStatus = "draft" | "published";

/** 봉투 + 내용물(헤더 행 = columns, 데이터 행 = rows). */
export interface Dataset extends DatasetEnvelope {
  id: string;
  authorUid: string;
  authorName: string;
  /** 공개 상태. 없으면(legacy) 공개로 취급. */
  status?: DatasetStatus;
  /** 원본과 대조·확정한 검수자 표시명. */
  reviewedBy?: string;
  /** 검수/공개 시각 ISO. */
  reviewedAt?: string;
  /** 엑셀 헤더 행. */
  columns: string[];
  /** 데이터 행들 (저장 상한까지). */
  rows: string[][];
  /** 실제 총 행 수 (상한 초과 시 rows.length보다 클 수 있음). */
  rowCount: number;
  /** PDF에서 추출된 경우, 원본 소스([[PdfSource]])의 id. 엑셀 업로드면 없음. */
  sourceId?: string;
  /** 원문 PDF 열람 URL (챗봇 답변의 "원문 보기" 링크용). */
  originalUrl?: string;
  /** 이 표가 있던 원본 PDF 시작 페이지(1-based). "출처 페이지만 잘라 다운로드"용. */
  sourcePage?: number;
  /** 여러 페이지 표면 끝 페이지. 단일 페이지면 sourcePage와 같음. */
  sourceEndPage?: number;
  createdAt: string;
}

// ── 원본 PDF 소스(요강 등) ────────────────────────────────────
// 큰 원본은 Firebase Storage에 두고, 여기(Firestore pdf_sources)엔 메타 + 경로만.
// 추출된 데이터셋(Dataset.sourceId)과 서술형 자료가 이 원본을 참조한다.
// docType으로 정형(표 추출) / 서술형(원문+해설)을 구분.

export type DocType =
  | "수시모집요강"
  | "정시모집요강"
  | "모집요강" // 수시·정시를 한 권으로 내는 대학용 통합본
  | "전형시행계획"
  | "선행학습영향평가보고서" // 서술형
  | "대학별고사자료"; // 논술·면접 기출 등 (서술형)

export type UnivType = "국립" | "공립" | "사립";

/** Storage에 올라간 원본 PDF 1건의 메타데이터 (목록·필터·원문링크용). */
export interface PdfSource {
  id: string;
  university: string;
  univType: UnivType;
  region: string;
  isCapitalArea: boolean;
  docType: DocType;
  /** 학년도 (공식 라벨, 예: 2026). */
  admissionYear: number;
  /** 수능 치르는 해 = admissionYear - 1. 연도 혼동 방지로 분리 저장. */
  examYear: number;
  targetGrade: string;
  /** 발행/게시 시점 (YYYY-MM, 알면). */
  publishedAt: string;
  /** 원본 다운로드 출처 URL (대학 입학처 등). */
  sourceUrl: string;
  /** Firebase Storage 경로 (originals/{id}.pdf). */
  originalPath: string;
  /** 공개 열람 URL. */
  originalUrl: string;
  createdAt?: string;
}

/** 원본 등록 시 입력 (id 포함 — 대학·연도 기반 안정 식별자). */
export type PdfSourceInput = Omit<PdfSource, "createdAt">;

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
  /** 본문 전체 (해설·브리핑 등 텍스트 콘텐츠). 있으면 상세 페이지에서 렌더. */
  body?: string;
  /** 원문/상세 링크 (Drive 원문, 외부 URL). 텍스트 콘텐츠는 비고 body를 씀. */
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
