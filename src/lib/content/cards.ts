import type { ContentCard } from "../domain/types";
import { EVERGREEN } from "../domain/types";

// Seed content. In the MVP these cards are hand-authored and manually tagged
// to academic periods — that is the "달력 엔진 최소판". Later, AI draft
// generation and teacher contributions append to this set (eventually backed
// by Firestore). Tags must match ids in calendar/academicCalendar.ts.

export const CARDS: ContentCard[] = [
  // ── 중학교 ────────────────────────────────────────────────────
  {
    id: "mid-summer-career-quest",
    schoolLevel: "middle",
    category: "activity",
    title: "여름방학 진로 미션지 — '하루 직업 따라가기'",
    summary: "방학 중 학생이 관심 직업인의 하루를 조사·기록하는 1쪽 미션지.",
    body: [
      "관심 있는 직업 한 가지를 고르고, 그 직업인의 '평범한 하루'를 시간대별로 조사해 적어보는 활동입니다. 영상·인터뷰·기사 어디서 찾아도 괜찮습니다.",
      "아침에 무엇으로 하루를 시작하는지, 가장 많은 시간을 쓰는 일은 무엇인지, 누구와 협업하는지를 적게 하면 막연한 '꿈'이 구체적인 '하루'로 바뀝니다.",
      "개학 첫 주에 4명씩 모둠으로 서로의 미션지를 바꿔 읽고, '이 직업의 하루에서 가장 의외였던 점'을 한 문장씩 공유하게 하세요.",
    ].join("\n\n"),
    calendarTags: ["mid-pre-summer", "mid-summer"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 37,
  },
  {
    id: "mid-semester-reflection",
    schoolLevel: "middle",
    category: "checklist",
    title: "1학기 진로활동 성찰 체크리스트",
    summary: "학기말, 학생이 스스로 한 학기 진로활동을 돌아보는 7문항 체크리스트.",
    body: [
      "한 학기 동안의 진로활동을 학생 스스로 점검하는 체크리스트입니다. '새로 알게 된 직업이 있다 / 내 흥미를 한 가지 말로 표현할 수 있다 / 더 알아보고 싶은 분야가 생겼다' 같은 7개 문항에 ○△× 로 답하게 합니다.",
      "점수를 매기는 도구가 아니라, 2학기 진로활동을 무엇부터 이어갈지 학생이 스스로 정하게 하는 대화의 출발점입니다.",
      "체크 후 '×가 가장 마음에 걸리는 항목 하나'를 골라 2학기에 해보고 싶은 활동 한 줄을 적게 하면 그대로 다음 학기 계획이 됩니다.",
    ].join("\n\n"),
    calendarTags: ["mid-pre-summer"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 21,
  },
  {
    id: "mid-interest-card",
    schoolLevel: "middle",
    category: "activity",
    title: "흥미 발견 카드 — '나는 언제 시간 가는 줄 몰랐나'",
    summary: "검사지 없이 시작하는 자기이해 활동. 학기 초·언제든 쓰는 상시 카드.",
    body: [
      "진로검사 결과를 해석하기 전에, 학생 자신의 경험에서 흥미의 단서를 찾게 하는 활동입니다. 최근 한 달 중 '시간 가는 줄 몰랐던 순간' 세 가지를 적게 하세요.",
      "그 세 순간의 공통점을 찾게 하면, 검사가 알려주기 전에 학생이 스스로 흥미의 방향을 말로 꺼내게 됩니다.",
      "학기 초 진로 오리엔테이션이나, 진로검사 직전 워밍업으로 언제든 쓸 수 있습니다.",
    ].join("\n\n"),
    calendarTags: [EVERGREEN],
    source: "I&AI 미래역량교육연구소",
    usedCount: 58,
  },

  // ── 고등학교 ──────────────────────────────────────────────────
  {
    id: "high-record-evidence-sheet",
    schoolLevel: "high",
    category: "lesson",
    title: "탐구활동 → 세특 연결 기록지",
    summary: "학생 탐구활동을 학생부 기재로 잇는 '근거 문장' 정리 양식.",
    body: [
      "학생이 한 탐구활동을 세특에 어떻게 적을지 막막해하는 문제를 푸는 양식입니다. '무엇을 궁금해했는가 → 어떻게 알아봤는가 → 무엇을 새로 알게 됐는가 → 다음에 더 파고들고 싶은 것'의 네 칸으로 활동을 정리하게 합니다.",
      "교사가 대신 써주는 것이 아니라, 학생이 자기 활동의 '근거 문장'을 스스로 만들게 하는 도구입니다. 네 칸이 채워지면 기재의 재료가 학생의 언어로 모입니다.",
      "기재 마감 직전이 아니라 활동 직후에 작성하게 하면, 시즌에 몰아서 떠올리는 부담이 사라집니다.",
    ].join("\n\n"),
    calendarTags: ["high-record-season-1", "high-record-spring"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 44,
  },
  {
    id: "high-record-season-checklist",
    schoolLevel: "high",
    category: "checklist",
    title: "1학기 학생부 기재 마감 점검표",
    summary: "기재 시즌, 누락 없이 마감하기 위한 항목별 점검표.",
    body: [
      "기재 시즌에 빠뜨리기 쉬운 항목을 한 장으로 점검하는 표입니다. 진로활동 특기사항, 세특, 행동특성 및 종합의견 각각에 대해 '근거가 학생 활동에 있는가 / 추상어로만 쓰지 않았는가 / 학생마다 구별되는가'를 확인합니다.",
      "평가가 아니라 마감 직전의 자기 점검용입니다. '추상어로만 쓰지 않았는가' 항목은 특히, 활동 근거 없이 역량어로 채운 문장을 걸러내는 데 씁니다.",
    ].join("\n\n"),
    calendarTags: ["high-record-season-1", "high-record-season-2"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 29,
  },
  {
    id: "high-major-fit-question",
    schoolLevel: "high",
    category: "activity",
    title: "전공 적합성 점검 질문 5선",
    summary: "학과 선택을 '이름'이 아니라 '하게 될 공부'로 따져보게 하는 질문지.",
    body: [
      "학생이 학과를 이름이나 취업 전망만으로 고르는 것을 막는 질문지입니다. 관심 학과 하나를 정한 뒤 '이 학과 1학년이 배우는 과목 3개를 말할 수 있는가 / 그중 가장 끌리는 과목은 무엇인가 / 그 과목과 닿는 내 활동이 있었는가' 등 5개 질문에 답하게 합니다.",
      "답하지 못하는 질문이 곧 다음에 알아봐야 할 것입니다. 막연한 지망을 구체적인 탐색 과제로 바꿔줍니다.",
      "수시 준비 시즌이나 과목 선택 상담 어디에든 쓸 수 있는 상시 카드입니다.",
    ].join("\n\n"),
    calendarTags: ["high-susi", "high-record-season-2", EVERGREEN],
    source: "I&AI 미래역량교육연구소",
    usedCount: 51,
  },

  // ── 중학교 (추가: 빈 시기 메움) ───────────────────────────────
  {
    id: "mid-new-semester-orientation",
    schoolLevel: "middle",
    category: "activity",
    title: "첫 진로수업 아이스브레이커 — '올해의 나 소개 카드'",
    summary: "학기 초 서먹함을 깨고 학생의 관심을 한 장으로 모으는 활동.",
    body: [
      "새 학년 첫 진로수업에서, 학생이 '올해 해보고 싶은 것 / 요즘 빠져 있는 것 / 궁금한 직업' 세 칸을 채워 자기를 소개하는 카드입니다.",
      "교사는 이 카드를 걷어 학급 전체의 관심 지도를 그릴 수 있습니다. 누가 무엇에 끌리는지가 한눈에 보이면, 이후 진로활동을 학급 실제 관심에 맞춰 설계할 수 있습니다.",
      "첫 시간에 5분이면 충분합니다. 잘 쓰려 애쓰지 말고, 떠오르는 대로 적게 하세요.",
    ].join("\n\n"),
    calendarTags: ["mid-new-semester-1"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 18,
  },
  {
    id: "mid-exploration-questions",
    schoolLevel: "middle",
    category: "checklist",
    title: "진로체험 전·후 질문지 — 막연한 견학을 탐구로",
    summary: "체험 가기 전 질문을 만들고, 다녀와 답을 채우게 하는 2단 질문지.",
    body: [
      "진로체험을 수동적 견학에서 능동적 탐구로 바꾸는 질문지입니다. 체험 전, 학생이 '그곳에서 꼭 물어보거나 확인할 질문 3개'를 직접 만들게 하세요.",
      "질문을 미리 가진 학생은 같은 체험에서도 훨씬 많이 봅니다. 다녀온 뒤에는 그 답과 함께 '새로 생긴 질문'을 적게 해, 한 번의 체험이 다음 탐색으로 이어지게 합니다.",
    ].join("\n\n"),
    calendarTags: ["mid-career-exploration"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 33,
  },
  {
    id: "mid-semester2-connect",
    schoolLevel: "middle",
    category: "activity",
    title: "방학 경험 진로 연결 카드",
    summary: "방학 중 한 경험을 진로 관심과 잇는 2학기 첫 활동.",
    body: [
      "2학기 첫 진로수업에서, 방학 동안 가장 기억에 남는 경험 하나를 고르고 거기서 '재미있었던 부분'을 직업·분야와 연결해보는 활동입니다.",
      "거창한 경험이 아니어도 됩니다. 게임, 여행, 도와드린 집안일 무엇이든 — 일상 속에서 흥미의 단서를 찾아 진로로 잇는 연습입니다.",
    ].join("\n\n"),
    calendarTags: ["mid-new-semester-2"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 15,
  },
  {
    id: "mid-free-semester-showcase",
    schoolLevel: "middle",
    category: "lesson",
    title: "자유학기 성과 발표 — '내 탐구 3분 쇼케이스' 틀",
    summary: "한 학기 주제선택·진로탐색을 3분 발표로 정리하는 틀.",
    body: [
      "자유학기를 마무리하며 학생이 '무엇을 탐구했나 / 가장 놀란 점 / 더 알고 싶어진 것' 세 장으로 발표하는 틀입니다.",
      "결과물의 완성도가 아니라 탐구 '과정'을 말하게 하는 게 핵심입니다. 실패하거나 바뀐 방향도 좋은 발표 재료라고 미리 알려주세요.",
      "3분·3장 제한이 오히려 핵심을 고르게 만듭니다.",
    ].join("\n\n"),
    calendarTags: ["mid-free-semester-fall"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 24,
  },
  {
    id: "mid-year-timeline",
    schoolLevel: "middle",
    category: "checklist",
    title: "한 해 진로활동 타임라인 — '나의 1년 지도'",
    summary: "일 년 진로활동을 돌아보고 다음 학년 한 걸음을 정하는 마무리 활동.",
    body: [
      "올해 한 진로활동·체험·검사를 시간순으로 한 줄씩 적고, '가장 의미 있었던 것 하나'에 표시하는 활동입니다.",
      "마지막에 '내년에 이어가고 싶은 것 한 가지'를 적게 하면, 한 해가 단발 활동의 나열이 아니라 다음 학년으로 이어지는 흐름이 됩니다.",
    ].join("\n\n"),
    calendarTags: ["mid-year-wrap"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 12,
  },

  // ── 고등학교 (추가: 빈 시기 메움) ─────────────────────────────
  {
    id: "high-subject-choice-rationale",
    schoolLevel: "high",
    category: "checklist",
    title: "과목 선택 = 진로 설계 — '왜 이 과목인가' 한 줄 근거표",
    summary: "진로희망과 선택과목을 연결해 학생이 스스로 근거를 만드는 표.",
    body: [
      "선택하려는 과목 옆에 '내 진로와 어떻게 연결되나'를 한 줄로 적게 하는 표입니다. 근거를 쓰지 못하는 과목은 다시 생각하게 됩니다.",
      "막연한 과목 선택을 진로 일관성으로 잇는 도구이자, 나중에 학생부 진로활동·과목 선택 사유의 기재 근거가 됩니다.",
    ].join("\n\n"),
    calendarTags: ["high-new-semester-1"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 27,
  },
  {
    id: "high-summer-inquiry",
    schoolLevel: "high",
    category: "activity",
    title: "여름방학 진로 탐구 심화 미션 (1·2학년용)",
    summary: "방학 동안 관심 주제를 한 단계 깊이 파보는 자기주도 탐구 미션지.",
    body: [
      "1학기 세특이나 수업에서 다룬 주제 하나를 골라 '더 알아보고 싶은 질문 1개'를 정하고, 방학 중 신뢰할 자료 3개를 찾아 정리하는 미션입니다.",
      "이 한 질문이 2학기 탐구활동과 세특의 씨앗이 됩니다. 방학에 새로 시작하기보다, 이미 관심 가진 것을 깊게 파는 쪽이 학생부 일관성에도 유리합니다.",
      "3학년은 탐구보다 수시 라인업 점검이 우선이니 별도 자료를 참고하세요.",
    ].join("\n\n"),
    calendarTags: ["high-summer"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 31,
  },
  {
    id: "high-year-roadmap",
    schoolLevel: "high",
    category: "checklist",
    title: "다음 학년 진로 로드맵 — '한 장 계획서'",
    summary: "학년 마무리에 다음 해 진로·학업 계획을 한 장으로 정리.",
    body: [
      "'올해 확인한 내 관심 / 내년에 들을 과목 / 채우고 싶은 활동 한 가지'를 한 장에 정리하는 계획서입니다.",
      "방학 사이에 흐려지기 쉬운 진로 방향을 한 장으로 붙들어, 다음 학년 첫날부터 이어가게 합니다. 진학을 마무리하는 3학년은 후배에게 남기는 조언 한 줄로 갈음할 수 있습니다.",
    ].join("\n\n"),
    calendarTags: ["high-year-wrap"],
    source: "I&AI 미래역량교육연구소",
    usedCount: 14,
  },
];
