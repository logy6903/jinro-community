// 내신 엔진 골든 케이스 (회귀 테스트). 손으로 계산한 기대값과 엔진 결과를 대조.
// QA 설계의 "역산/골든 케이스" 첫 사례. 실패 시 비0 종료.
// 실행: npx tsx scripts/naeshin-golden.mjs
import assert from "node:assert/strict";

const { computeNaeshin } = await import("../src/lib/naeshin/engine.ts");
const { SKKU_2026_HAKJANG } = await import(
  "../src/lib/naeshin/specs/skku-2026-hakjang.ts"
);

// 샘플 성적표 (분류된 입력). 진로선택(none)은 미반영.
const transcript = [
  { name: "국어", group: "A", grade: 1, units: 4 }, // 100
  { name: "수학", group: "A", grade: 2, units: 4 }, // 96
  { name: "영어", group: "A", grade: 1, units: 4 }, // 100
  { name: "한국사", group: "A", grade: 3, units: 2 }, // 90
  { name: "기술가정", group: "B", grade: 2, units: 2 }, // 98
  { name: "한문", group: "B", grade: 3, units: 3 }, // 95
  { name: "물리학II(진로선택)", group: "none", grade: 1, units: 4 }, // 미반영
];

// 손계산:
//  A: Σ(점수×단위)=100*4+96*4+100*4+90*2=1364, Σ단위=14, 1차=97.428..., A최종=1364/14*7=682.0
//  B: Σ=98*2+95*3=481, Σ단위=5, 1차=96.2, B최종=96.2
//  총=778.2, 미반영=[물리학II]
const r = computeNaeshin(SKKU_2026_HAKJANG, transcript);

function close(a, b, msg) {
  assert.ok(Math.abs(a - b) < 1e-6, `${msg}: got ${a}, expected ${b}`);
}

const A = r.groups.find((g) => g.key === "A");
const B = r.groups.find((g) => g.key === "B");

close(A.sumWeighted, 1364, "A sumWeighted");
close(A.sumUnits, 14, "A sumUnits");
close(A.firstScore, 1364 / 14, "A 1차점수");
close(A.finalScore, 682.0, "A 최종");
close(B.firstScore, 96.2, "B 1차점수");
close(B.finalScore, 96.2, "B 최종");
close(r.total, 778.2, "총점");
assert.deepEqual(r.ignored, ["물리학II(진로선택)"], "미반영 과목");

console.log("✅ 골든 케이스 통과");
console.log(`  A최종=${A.finalScore}  B최종=${B.finalScore}  총점=${r.total}`);
console.log(`  미반영: ${r.ignored.join(", ")}`);
process.exit(0);
