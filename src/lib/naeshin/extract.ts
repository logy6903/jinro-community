import Anthropic from "@anthropic-ai/sdk";
import type { GroupSpec } from "./types";

// 요강의 "학생부(내신) 정량 평가 방법"에서 산출 파라미터(spec)를 뽑는다.
// LLM은 여기서만 쓴다 — 파라미터 추출용. 계산은 결정론 엔진이 하고, 추출 결과는
// 반드시 검수 UI(역산/골든)로 검증한 뒤 써야 한다(AI라 틀릴 수 있으므로).
// 추출은 페이지 범위로 좁혀 전송(split)하는 걸 전제 → 비용↓·정확도↑.

const MODEL = "claude-opus-4-8";

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client !== undefined) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  client = apiKey ? new Anthropic({ apiKey }) : null;
  return client;
}
export function isConfigured(): boolean {
  return getClient() !== null;
}

/** 추출된 정량 산출 사양(가중평균형). 캘러가 id·university·pattern을 채운다. */
export interface ExtractedNaeshinSpec {
  track: string;
  maxScore: number;
  groups: GroupSpec[];
}

const SYSTEM = [
  "너는 한국 대학 요강의 '학교생활기록부(내신) 정량 평가 방법'에서 산출 파라미터를 추출한다.",
  "가중평균형을 가정한다: 군별로 (석차등급→반영점수표), 1차점수=Σ(과목별 반영점수×이수단위)/Σ이수단위, 군 최종=1차×반영비, 총점=Σ 군 최종.",
  "각 군에 대해: key(A/B 등 군 식별자), name(반영교과 설명), gradeScore(석차등급 1~9의 반영점수 9개를 순서대로 배열), reflectRatio(반영비, 1차에 곱하는 수).",
  "전체: track(전형명), maxScore(정량 총점 만점 = Σ(군 만점 100 × 반영비)).",
  "정성평가·면접은 사람 평가라 제외한다. 오직 정량(등급→점수 환산) 부분만.",
  "출력은 오직 JSON: {\"track\":\"\",\"maxScore\":0,\"groups\":[{\"key\":\"\",\"name\":\"\",\"gradeScore\":[0,0,0,0,0,0,0,0,0],\"reflectRatio\":0}]}. 다른 말 금지.",
].join("\n");

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function extractNaeshinSpec(
  pdfBase64: string,
): Promise<ExtractedNaeshinSpec | null> {
  const c = getClient();
  if (!c) return null;
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: "이 요강의 학생부 정량 평가 산출 파라미터를 추출해줘." },
        ],
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const fenced = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  let parsed: {
    track?: unknown;
    maxScore?: unknown;
    groups?: unknown;
  } | null;
  try {
    parsed = JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.groups)) return null;

  const groups: GroupSpec[] = parsed.groups
    .slice(0, 6)
    .map((g) => {
      const o = (g ?? {}) as Record<string, unknown>;
      const gs = Array.isArray(o.gradeScore) ? o.gradeScore.slice(0, 9).map(num) : [];
      while (gs.length < 9) gs.push(0);
      return {
        key: typeof o.key === "string" ? o.key.trim().slice(0, 8) : "?",
        name: typeof o.name === "string" ? o.name.trim().slice(0, 200) : "",
        gradeScore: gs,
        reflectRatio: num(o.reflectRatio),
      };
    })
    .filter((g) => g.key);

  if (groups.length === 0) return null;
  return {
    track: typeof parsed.track === "string" ? parsed.track.trim().slice(0, 80) : "",
    maxScore: num(parsed.maxScore),
    groups,
  };
}
