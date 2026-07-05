import type { AcademicPeriod } from "../domain/types";

// The academic-calendar table. Edit this to retune what surfaces when —
// no engine code changes required. Ranges are intentionally non-overlapping
// per level so exactly one period is active on any given day (evergreen cards
// fill the gaps). Dates follow the Korean school year.

export const ACADEMIC_PERIODS: AcademicPeriod[] = [
  // ── 중학교: 자유학기 · 진로탐색 축 ──────────────────────────────
  {
    id: "mid-new-semester-1",
    level: "middle",
    label: "1학기 시작 · 진로 오리엔테이션",
    hint: "학급 진로 분위기 만들기, 자기이해 활동으로 출발하는 시기",
    start: "03-02",
    end: "03-31",
  },
  {
    id: "mid-career-exploration",
    level: "middle",
    label: "진로탐색 · 진로체험 집중기",
    hint: "진로체험주간 · 직업 탐색 활동을 가장 많이 운영하는 시기",
    start: "04-01",
    end: "05-31",
  },
  {
    id: "mid-pre-summer",
    level: "middle",
    label: "1학기 마무리 · 여름방학 진로과제",
    hint: "한 학기 진로활동을 성찰하고, 방학 중 체험·독서 과제를 안내하는 시기",
    start: "06-01",
    end: "07-20",
  },
  {
    id: "mid-summer",
    level: "middle",
    label: "여름방학",
    hint: "방학 중 진로체험·진로독서 과제가 돌아가는 시기",
    start: "07-21",
    end: "08-20",
  },
  {
    id: "mid-new-semester-2",
    level: "middle",
    label: "2학기 시작",
    hint: "방학 과제 공유, 2학기 진로활동 재시동",
    start: "08-21",
    end: "09-30",
  },
  {
    id: "mid-free-semester-fall",
    level: "middle",
    label: "자유학기 집중 운영 · 발표",
    hint: "자유학기 주제선택·진로탐색 활동의 성과를 정리·발표하는 시기",
    start: "10-01",
    end: "11-30",
  },
  {
    id: "mid-year-wrap",
    level: "middle",
    label: "학년 마무리 · 진급 준비",
    hint: "한 해 진로활동 갈무리, 다음 학년 연계 준비",
    start: "12-01",
    end: "02-28",
  },

  // ── 고등학교: 학생부 · 진로선택 · 입시 연계 축 ───────────────────
  {
    id: "high-new-semester-1",
    level: "high",
    label: "1학기 시작 · 진로선택과목 안내",
    hint: "진로희망과 과목 선택을 연결해주는 시기",
    start: "03-02",
    end: "03-31",
  },
  {
    id: "high-record-spring",
    level: "high",
    label: "1학기 세특 · 탐구활동 설계",
    hint: "학생 탐구활동을 설계·코칭해 학생부 기재로 잇는 시기",
    start: "04-01",
    end: "05-31",
  },
  {
    id: "high-record-season-1",
    level: "high",
    label: "1학기 학생부 기재 시즌",
    hint: "기말 이후 세특·진로활동을 기재 마감으로 정리하는 시기",
    start: "06-01",
    end: "07-20",
  },
  {
    id: "high-summer",
    level: "high",
    label: "여름방학 · 수시 준비",
    hint: "3학년 수시 라인업 점검, 1·2학년 진로 탐구 심화",
    start: "07-21",
    end: "08-31",
  },
  {
    id: "high-susi",
    level: "high",
    label: "수시 원서 접수 시즌",
    hint: "9월 수시 접수 — 자기소개·면접·진로 일관성 점검이 몰리는 시기",
    start: "09-01",
    end: "09-30",
  },
  {
    id: "high-record-season-2",
    level: "high",
    label: "2학기 학생부 마감 시즌",
    hint: "2학기 세특·진로활동 마감, 다음 학년 과목 선택 상담",
    start: "10-01",
    end: "12-31",
  },
  {
    id: "high-year-wrap",
    level: "high",
    label: "학년 마무리 · 진급/진학 정리",
    hint: "정시·진학 마무리와 다음 학년 진로 설계 준비",
    start: "01-01",
    end: "02-28",
  },
];
