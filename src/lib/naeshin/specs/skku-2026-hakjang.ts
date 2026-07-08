import type { NaeshinSpec } from "../types";

// 성균관대 2026 학생부교과(학교장추천) 학교생활기록부 정량 평가 사양.
// 출처: 성대 2026 수시요강 p40 "5. 학교생활기록부 평가방법 - 가. 정량 평가 방법".
// (정성평가·면접은 사람 평가라 자동산출 대상 아님 — 이 엔진은 정량만.)
//
// A군(국·수·영·한국사·사회·과학) 반영비 7 (만점 700),
// B군(기술가정·제2외국어·한문) 반영비 1 (만점 100). 총 정량 만점 800.
// 반영교과 = 공통·일반선택과목만(진로선택·전문교과 미반영), 학년별 반영비율 없음.

export const SKKU_2026_HAKJANG: NaeshinSpec = {
  id: "skku-2026-hakjang",
  university: "성균관대학교",
  track: "학생부교과(학교장추천)",
  pattern: "weighted_average",
  maxScore: 800,
  groups: [
    {
      key: "A",
      name: "국어·수학·영어·한국사·사회(역사/도덕)·과학 (공통·일반선택)",
      gradeScore: [100, 96, 90, 80, 65, 45, 20, 10, 0],
      reflectRatio: 7,
    },
    {
      key: "B",
      name: "기술·가정·제2외국어·한문 (공통·일반선택)",
      gradeScore: [100, 98, 95, 90, 80, 50, 30, 10, 0],
      reflectRatio: 1,
    },
  ],
};
