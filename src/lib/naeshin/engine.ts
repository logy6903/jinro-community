import type {
  GroupTrace,
  NaeshinResult,
  NaeshinSpec,
  SubjectTrace,
  TranscriptSubject,
} from "./types";

// 내신 정량 산출 엔진 — 가중평균형. 결정론적이고 관찰가능(단계별 trace 반환).
// 군별로: 과목의 석차등급 → 환산표로 반영점수 → 1차 = Σ(점수×단위)/Σ단위
//        → 군 최종 = 1차 × 반영비. 총점 = Σ 군 최종.
// 반올림은 하지 않는다(중간값 보존) — 표시 단계에서 필요한 만큼만 반올림.

/** 석차등급(1~9) → 반영점수. 범위 밖이면 null(미반영). */
function scoreFor(gradeScore: number[], grade: number): number | null {
  if (!Number.isInteger(grade) || grade < 1 || grade > gradeScore.length) {
    return null;
  }
  return gradeScore[grade - 1];
}

export function computeNaeshin(
  spec: NaeshinSpec,
  subjects: TranscriptSubject[],
): NaeshinResult {
  const ignored: string[] = [];
  const groups: GroupTrace[] = spec.groups.map((g) => {
    const traces: SubjectTrace[] = [];
    let sumWeighted = 0;
    let sumUnits = 0;
    for (const s of subjects) {
      if (s.group !== g.key) continue;
      const score = scoreFor(g.gradeScore, s.grade);
      if (score === null || s.units <= 0) {
        ignored.push(s.name);
        continue;
      }
      traces.push({ name: s.name, grade: s.grade, score, units: s.units });
      sumWeighted += score * s.units;
      sumUnits += s.units;
    }
    const firstScore = sumUnits > 0 ? sumWeighted / sumUnits : 0;
    const finalScore = firstScore * g.reflectRatio;
    return {
      key: g.key,
      name: g.name,
      subjects: traces,
      sumWeighted,
      sumUnits,
      firstScore,
      reflectRatio: g.reflectRatio,
      finalScore,
    };
  });

  // 어느 군에도 안 속한 과목(group이 "none" 등)도 미반영으로 기록.
  for (const s of subjects) {
    if (!spec.groups.some((g) => g.key === s.group) && !ignored.includes(s.name)) {
      ignored.push(s.name);
    }
  }

  const total = groups.reduce((acc, g) => acc + g.finalScore, 0);
  return { specId: spec.id, total, groups, ignored };
}
