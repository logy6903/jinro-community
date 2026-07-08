import Anthropic from "@anthropic-ai/sdk";
import type {
  ExtractedNote,
  ExtractedTable,
  TableKind,
  TableMap,
  TableMapEntry,
} from "./types";

// 요강 PDF 다단 추출 엔진. Claude가 PDF를 네이티브로(텍스트+비전) 읽어 표
// 레이아웃을 인식한다. 추출은 업로드 시 1회성이므로 정확도 우선 — 값싼 Haiku
// 대신 Opus 4.8(1M 컨텍스트로 긴 요강도 커버)을 쓴다. 챗봇 질의 비용엔 영향 0.
// getClient는 answer.ts와 같은 패턴 (미설정 시 null 폴백).

const MODEL = "claude-opus-4-8";
const KINDS: TableKind[] = [
  "모집인원",
  "반영비율",
  "최저기준",
  "환산점수",
  "일정",
  "기타",
];

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

const MAP_SYSTEM = [
  "너는 한국 대학 입시요강(요강) PDF를 분석한다. 본문/머리글/바닥글이 아니라 '표(table)'만 찾아 목록으로 만든다.",
  "각 표에 대해: title(짧은 한국어 라벨), page(1부터), kind(모집인원/반영비율/최저기준/환산점수/일정/기타 중 추정), hasNotes(표에 딸리거나 아래에 ※·주)·각주 주석이 있으면 true), location(위치 힌트 예: '3페이지 상단').",
  "이 단계는 '정확히 읽기'가 아니라 '어디에 표가 있나'만 파악하는 것이다. 표가 아닌 서술형 문단은 제외.",
  "출력은 오직 JSON: {\"tables\":[{\"title\":\"\",\"page\":1,\"kind\":\"\",\"hasNotes\":false,\"location\":\"\"}],\"pageCount\":0}. 다른 말 금지.",
].join("\n");

const EXTRACT_SYSTEM = [
  "너는 한국 대학 요강 PDF에서 지정된 표 '하나'만 정밀 추출한다.",
  "규칙:",
  "1) 병합셀·중첩헤더를 전부 풀어 정규화(롱포맷)한다. 종이 그리드를 흉내내지 말고, 논리 축마다 열을 만들어 한 조합당 한 행으로 편다 (예: 전형 | 학과 | 과목 | 지표 | 값). 병합된 라벨은 해당하는 모든 행에 반복해 채운다.",
  "2) 표 바깥 주석(※·주)·각주)은 '조건'으로 읽는다. notes에 {marker, text, appliesTo}로 담되, appliesTo는 어느 행/칸에 걸리는지 서술(표 전체면 빈 문자열). 주석은 절대 누락 금지 — 조건 없는 행은 오답이다.",
  "3) 셀이 안 읽히거나 확신이 없으면 값은 넣되 confidence를 낮춘다.",
  "4) 지정된 표만 추출한다. 그 페이지의 다른 표는 무시.",
  "출력은 오직 JSON: {\"columns\":[\"\"],\"rows\":[[\"\"]],\"notes\":[{\"marker\":\"\",\"text\":\"\",\"appliesTo\":\"\"}],\"confidence\":0.0}. 다른 말 금지.",
].join("\n");

/** 응답 텍스트에서 JSON 객체를 견고하게 파싱 (```json 펜스·앞뒤 잡음 제거). */
function parseJson(text: string): unknown {
  const fenced = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

function textOf(res: Anthropic.Message): string {
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

function pdfBlock(pdfBase64: string): Anthropic.DocumentBlockParam {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
  };
}

function str(v: unknown, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : v == null ? "" : String(v).trim().slice(0, max);
}

/** Pass 1 — 표 지도. */
export async function mapTables(pdfBase64: string): Promise<TableMap | null> {
  const c = getClient();
  if (!c) return null;
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system: MAP_SYSTEM,
    messages: [
      {
        role: "user",
        content: [pdfBlock(pdfBase64), { type: "text", text: "이 PDF의 모든 표를 지도로 만들어줘." }],
      },
    ],
  });
  const parsed = parseJson(textOf(res)) as {
    tables?: unknown;
    pageCount?: unknown;
  } | null;
  if (!parsed || !Array.isArray(parsed.tables)) return null;

  const tables: TableMapEntry[] = parsed.tables
    .slice(0, 60)
    .map((t, i) => {
      const o = (t ?? {}) as Record<string, unknown>;
      const kind = KINDS.includes(o.kind as TableKind) ? (o.kind as TableKind) : "기타";
      const page = Number(o.page);
      return {
        id: `t${i}`,
        title: str(o.title, 120) || `표 ${i + 1}`,
        page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
        kind,
        hasNotes: o.hasNotes === true,
        location: str(o.location, 60),
      };
    });
  const pageCount = Number(parsed.pageCount);
  return { tables, pageCount: Number.isFinite(pageCount) ? pageCount : undefined };
}

/** Pass 2 — 표 하나 정밀 추출 (페이지 범위로 좁힘). */
export async function extractTable(
  pdfBase64: string,
  ref: { title: string; page: number },
): Promise<ExtractedTable | null> {
  const c = getClient();
  if (!c) return null;
  const instruction = `추출 대상 표: 제목="${ref.title}", 페이지=${ref.page}. 이 페이지의 이 표만 정규화 롱포맷으로 추출하고, 표 바깥 주석은 조건으로 함께 담아줘.`;
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: [pdfBlock(pdfBase64), { type: "text", text: instruction }],
      },
    ],
  });
  const parsed = parseJson(textOf(res)) as {
    columns?: unknown;
    rows?: unknown;
    notes?: unknown;
    confidence?: unknown;
  } | null;
  if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.rows)) {
    return null;
  }

  const columns = parsed.columns.slice(0, 40).map((x) => str(x, 120));
  const rows = parsed.rows
    .slice(0, 500)
    .map((r) => (Array.isArray(r) ? r : []).slice(0, columns.length).map((x) => str(x, 1000)));
  const notes: ExtractedNote[] = (Array.isArray(parsed.notes) ? parsed.notes : [])
    .slice(0, 40)
    .map((n) => {
      const o = (n ?? {}) as Record<string, unknown>;
      return { marker: str(o.marker, 20), text: str(o.text, 1000), appliesTo: str(o.appliesTo, 200) };
    })
    .filter((n) => n.text);
  const conf = Number(parsed.confidence);

  return {
    columns,
    rows,
    notes,
    confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
  };
}
