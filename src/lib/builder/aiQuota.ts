// 자막 없는 영상의 AI 받아쓰기 — 교사별 무료 할당량.
//
// WHY: 자막이 있는 영상은 1 크레딧이지만, 자막이 없어 AI가 음성을 받아쓰면
// "영상 1분당 2 크레딧"이다. 즉 비용이 요청 수가 아니라 **영상 길이**에
// 좌우된다. 30분 영상 하나면 60 크레딧 — 10분 영상 6개와 같다.
// 그래서 횟수만으로는 상한이 잡히지 않는다.
//
// 두 겹으로 막는다:
//   1) 횟수 — 교사에게 보여줄 값. "무료 3회 중 2회 남음"처럼 이해하기 쉽다.
//   2) 크레딧 — 보이지 않는 안전망. 아주 긴 영상 하나가 할당량을 통째로
//      먹어치우는 경우를 막는다. 실제 소모량은 응답 헤더로 받아 누적한다.
// 둘 중 하나라도 소진되면 AI 받아쓰기를 막는다.

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase/admin";
import { TEACHERS_COLLECTION } from "./teacherProfile";

/** 교사 1명에게 무료로 주는 AI 받아쓰기 횟수. */
export const FREE_AI_USES = Number(process.env.AI_TRANSCRIPT_FREE_USES ?? 3);

/**
 * 교사 1명의 무료 크레딧 상한. 기본 80 ≈ 10분짜리 영상 4편.
 * 3회를 다 쓰기 전에 이 값에 먼저 닿을 수 있다(긴 영상을 골랐을 때).
 * 그게 의도다 — 비용은 길이에 비례하므로 길이를 무시한 횟수 제한은
 * 상한이 되지 못한다.
 */
export const FREE_AI_CREDITS = Number(process.env.AI_TRANSCRIPT_CREDIT_CAP ?? 80);

/** 한 번에 받아쓸 수 있는 영상 길이 상한(분). 이보다 길면 시도조차 안 한다. */
export const MAX_AI_MINUTES = Number(process.env.AI_TRANSCRIPT_MAX_MINUTES ?? 20);

export interface AiQuota {
  /** 지금까지 쓴 횟수. */
  uses: number;
  /** 지금까지 쓴 크레딧(실제 청구량 누적). */
  credits: number;
  /** 남은 횟수 (0 이상). */
  usesLeft: number;
  /** 더 쓸 수 있는가 — 횟수·크레딧 둘 다 남아야 true. */
  allowed: boolean;
}

function toQuota(uses: number, credits: number): AiQuota {
  const usesLeft = Math.max(0, FREE_AI_USES - uses);
  return {
    uses,
    credits,
    usesLeft,
    allowed: usesLeft > 0 && credits < FREE_AI_CREDITS,
  };
}

/** Firebase 미설정이면 0/0으로 취급해 기능이 열려 있게 둔다(로컬 개발). */
export async function getAiQuota(uid: string): Promise<AiQuota> {
  const db = getAdminDb();
  if (!db) return toQuota(0, 0);
  const doc = await db.collection(TEACHERS_COLLECTION).doc(uid).get();
  const d = doc.data();
  return toQuota(
    typeof d?.aiTranscriptUses === "number" ? d.aiTranscriptUses : 0,
    typeof d?.aiTranscriptCredits === "number" ? d.aiTranscriptCredits : 0,
  );
}

/**
 * 실제로 쓴 만큼 기록한다. `credits`는 응답 헤더(x-billable-requests)에서
 * 받은 실제 청구량. 헤더가 없으면 호출자가 보수적으로 추정해 넘긴다
 * (적게 잡아 과금이 새는 것보다 많게 잡는 편이 안전하다).
 */
export async function recordAiTranscript(
  uid: string,
  credits: number,
): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  await db
    .collection(TEACHERS_COLLECTION)
    .doc(uid)
    .set(
      {
        aiTranscriptUses: FieldValue.increment(1),
        aiTranscriptCredits: FieldValue.increment(Math.max(1, Math.round(credits))),
        aiTranscriptLastAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
