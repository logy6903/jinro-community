import { ACADEMIC_PERIODS } from "../calendar/academicCalendar";
import type { ScheduleItem } from "../domain/types";

// 공용 일정 = 학사/진로 시기 테이블(academicCalendar)에서 파생. 로그인 없이 누구나
// 보는 기본 레이어. 교사는 이 위에 학교 일정을 얹는다. (static — 클라이언트 import 가능)

export function commonScheduleItems(): ScheduleItem[] {
  return ACADEMIC_PERIODS.map((p) => ({
    id: `common-${p.id}`,
    level: p.level,
    title: p.label,
    hint: p.hint,
    start: p.start,
    end: p.end,
    origin: "common",
  }));
}
