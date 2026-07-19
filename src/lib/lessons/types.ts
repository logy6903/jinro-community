import type { SchoolLevel } from "../domain/types";

// 차시별 수업안 생성 — 공유 자료(원자료)를 쓰려는 교사가 "몇 차시로, 어떤 조건·
// 바이브로" 입력하면 AI가 차시별 수업 계획안 초안을 짜는 흐름의 타입.
//
// 두 객체가 갈린다:
//  - 원자료(source): 올린 교사 소유, 자료실에서 공유. (슬라이스1은 기존 ContentCard 재사용)
//  - 수업안(LessonPlan): 쓰는 교사가 원자료 + 입력으로 생성한 결과. 초안 → 검수 → 확정.
// AI는 초안만 만들고 교사가 확정한다(요강 검수와 같은 draft→confirm 모델).
// 저장·소유(작성자 A / 생성자 B)·차시별 활동 패널은 슬라이스2.

/** 수업 진행 형태 — 결과의 활동 밀도·구성에 영향을 준다. */
export type LessonFormat = "lecture" | "group" | "activity" | "mixed";

export const LESSON_FORMAT_LABEL: Record<LessonFormat, string> = {
  lecture: "강의형",
  group: "모둠활동형",
  activity: "체험·활동형",
  mixed: "혼합형",
};

/**
 * 쓰는 교사가 생성 시 넣는 입력. `numSessions`만 필수이고 나머지는 결과 질을
 * 높이는 선택값이다. `notes`는 자유 자연어("바이브") — 구조화 노브가 못 담는 걸
 * 전부 흡수한다(반 사정·추가하고 싶은 활동·강조점 등).
 */
export interface LessonPlanInput {
  /** 필수: 몇 차시로 구성할지. */
  numSessions: number;
  /** 대상 학교급. 없으면 원자료의 값을 쓴다. */
  schoolLevel?: SchoolLevel;
  /** 차시당 수업 시간(분). 없으면 학교급 기본값으로 생성. */
  minutesPerSession?: number;
  /** 수업 형태. */
  format?: LessonFormat;
  /** 특히 강조할 목표(짧은 자유 텍스트). */
  emphasis?: string;
  /**
   * 자유 입력("바이브") — 추가하고 싶은 내용·강조·반 사정 등을 자연어로.
   * 예) "우리 반은 발표를 어려워하니 글쓰기 위주로", "마지막에 학생부 연결 활동 하나".
   */
  notes?: string;
}

/** 한 차시(session)의 계획. */
export interface LessonSession {
  /** 1-based 차시 번호. */
  order: number;
  /** 이 차시 제목. */
  title: string;
  /** 학습목표 (1~2개, 한 문장씩). */
  objectives: string[];
  /** 활동 단계 (순서대로). 각 단계에 소요 시간을 괄호로 붙이기도 한다. */
  steps: string[];
  /** 준비물. 없으면 빈 배열. */
  materials: string[];
  /** 이 차시 소요 시간(분). */
  minutes: number;
  /** 마무리 성찰·평가 한 줄. */
  reflection: string;
}

/**
 * 생성된 수업안. 슬라이스1에선 저장하지 않고 생성 즉시 렌더만 한다(id·author·
 * creator·저장은 슬라이스2). `input`을 함께 담아 "이 문구만 바꿔 다시 생성"이
 * 되도록 스냅샷을 보존한다.
 */
export interface LessonPlan {
  /** 원자료 식별자 (슬라이스1: ContentCard.id). */
  sourceId: string;
  /** 원자료 제목 (표시용). */
  sourceTitle: string;
  /** 생성 입력 스냅샷 (재생성용). */
  input: LessonPlanInput;
  /** 이 수업 전체를 2~3문장으로 요약한 개요. */
  overview: string;
  /**
   * 차시별 계획. `input.numSessions`와 같기를 기대하지만, AI가 못 맞추면
   * 그대로 노출하고 교사가 조정한다(초안 원칙).
   */
  sessions: LessonSession[];
}
