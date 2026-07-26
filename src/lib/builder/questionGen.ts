import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import { getYouTubeTranscript } from "./transcript";
import type { AiModelTier, ContentType, FieldType } from "./types";

// Draft-stage AI: read the materials a teacher put on an app (제시 자료) and
// propose a student activity grounded ONLY in those materials — no outside
// knowledge. Output is an ordered list of items: the AI may emit its own
// presentation blocks (a <보기> set) as well as questions. Runs once at
// authoring time (teacher side), not per student, so cost is negligible — Haiku
// by default, Opus opt-in. Images and PDFs are fetched server-side and sent as
// vision/document blocks so Claude reads the actual worksheet, not a caption.
//
// NOTE on video/links: 자막 획득은 `./transcript`가 담당한다(무료 innertube →
// 유료 폴백). 대본을 못 읽은 영상은 strict grounding에 따라 문항을 만들지
// 않으며, 왜 못 읽었는지(`linkNotes`)를 호출자에게 돌려줘 교사에게 정확한
// 안내를 띄우게 한다 — "자막 없는 영상"과 "서버가 차단됨"은 다른 상황이다.

const MODEL_ID: Record<AiModelTier, string> = {
  fast: "claude-haiku-4-5",
  smart: "claude-opus-4-8",
};

const MAX_FETCH_BYTES = 8 * 1024 * 1024; // 8MB per asset — keeps the request sane
type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const IMAGE_TYPES: ImageMedia[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_ITEMS = 30;

export interface SourceMaterial {
  contentType: ContentType;
  /** text: the body; image/pdf/link: the URL. */
  value: string;
  label?: string;
}

/**
 * A generated activity element. `content` is a presentation block the AI made
 * itself (a <보기> set, an extra passage); `field` is a student question.
 */
export type GeneratedItem =
  | { kind: "content"; label?: string; text: string }
  | { kind: "field"; type: FieldType; label: string; options?: string[] };

export interface GenerateOptions {
  count: number;
  tier: AiModelTier;
  /** How many options each generated 객관식 question should have. */
  choiceCount: number;
  /** Extra teacher instruction beyond the source material (optional). */
  instruction?: string;
}

async function fetchAsBase64(
  url: string,
): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_FETCH_BYTES) return null;
    const mediaType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

/** Why a link material could not be turned into questions. */
export interface LinkNote {
  label: string;
  status: "ok" | "no_captions" | "unavailable" | "not_youtube";
}

// Build the multimodal user content: an intro, each material as the right block,
// then the output instruction. Unreadable assets degrade to a text note.
async function buildContent(
  materials: SourceMaterial[],
  opts: GenerateOptions,
  linkNotes: LinkNote[],
  /** Incremented per material we actually managed to read. Out-param so the
   *  caller can refuse to ship questions with nothing behind them. */
  readable: { count: number },
): Promise<Anthropic.ContentBlockParam[]> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: "다음은 교사가 학생에게 제시한 수업 자료입니다. 이 자료들을 분석해 학생 활동을 만들어 주세요.",
    },
  ];

  for (const m of materials) {
    const caption = m.label?.trim() ? `[자료: ${m.label.trim()}]` : "[자료]";
    if (m.contentType === "text") {
      readable.count += 1;
      content.push({ type: "text", text: `${caption}\n${m.value}` });
    } else if (m.contentType === "link") {
      const t = await getYouTubeTranscript(m.value);
      const noteLabel = m.label?.trim() || m.value;
      if (t.status === "ok") {
        readable.count += 1;
        linkNotes.push({ label: noteLabel, status: "ok" });
        content.push({
          type: "text",
          text: `${caption} (유튜브 영상 대본)\n제목: ${t.title}\n${t.text}`,
        });
      } else {
        linkNotes.push({ label: noteLabel, status: t.status });
        const why =
          t.status === "no_captions"
            ? "자막이 없어"
            : t.status === "not_youtube"
              ? "유튜브 영상이 아니어서"
              : "대본을 가져오지 못해";
        content.push({
          type: "text",
          text: `${caption} (링크: ${m.value})\n※ ${why} 내용을 읽지 못했습니다. 이 링크 내용에 대한 문항은 만들지 마세요.`,
        });
      }
    } else if (m.contentType === "image") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched && (IMAGE_TYPES as readonly string[]).includes(fetched.mediaType)) {
        readable.count += 1;
        content.push({ type: "text", text: caption });
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: fetched.mediaType as ImageMedia,
            data: fetched.data,
          },
        });
      } else {
        content.push({ type: "text", text: `${caption} (이미지 자료 — 열 수 없어 이 이미지 문항은 만들지 마세요)` });
      }
    } else if (m.contentType === "office") {
      // PPT/워드/엑셀은 학생 화면에 뷰어로 펼쳐 보여주기만 하고, 본문은 읽지
      // 못한다(모델이 직접 지원하지 않는 형식). 근거 없는 출제를 막는다.
      content.push({
        type: "text",
        text: `${caption} (PPT/워드/엑셀 자료 — 내용을 읽지 못했습니다. 이 자료에 대한 문항은 만들지 마세요. 필요하면 교사가 본문을 '텍스트' 자료로 붙여넣어야 합니다.)`,
      });
    } else if (m.contentType === "pdf") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched) {
        readable.count += 1;
        content.push({ type: "text", text: caption });
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fetched.data },
        });
      } else {
        content.push({ type: "text", text: `${caption} (PDF 자료 — 열 수 없어 이 PDF 문항은 만들지 마세요)` });
      }
    }
  }

  const extra = opts.instruction?.trim()
    ? `\n\n[교사 추가 요청 — 자료 범위 안에서 반영]\n${opts.instruction.trim()}`
    : "";

  content.push({
    type: "text",
    text:
      `오직 위에 제시된 자료 안의 내용만 근거로 학생 활동을 만들어 주세요. 자료에 없는 내용·배경지식·추측은 절대 넣지 마세요. 학생이 이 자료만 보고 풀 수 있어야 합니다.\n` +
      `출력은 오직 JSON 배열이며, 순서가 있는 항목들입니다. 각 항목은 둘 중 하나입니다.\n` +
      `1) 제시·보기 블록: {"kind":"content","label":"보기","text":"내용"} — 문항이 참조할 <보기>·지문·표 등 학생에게 보여줄 자료. 필요할 때만, 해당 문항 바로 앞에 배치하세요.\n` +
      `2) 문항: {"kind":"field","type":"short"|"long"|"choice","label":"문항 텍스트","options":["보기1","보기2"]} — options는 type이 choice일 때만.\n` +
      `문항은 자료로 확실히 낼 수 있는 범위에서 최대 ${opts.count}개까지 만드세요(자료가 부족하면 더 적게, 지어내지 말 것). 객관식(choice) 문항의 선지(options)는 정확히 ${opts.choiceCount}개로 만드세요. 단답은 short, 서술형은 long입니다.\n` +
      `한국 학교 시험 형식으로 만드세요.\n` +
      `- 문항 어투는 시험체로: 예) "…에 대한 설명으로 옳은 것은?", "…로 가장 적절한 것은?", "…에서 있는 대로 고른 것은?".\n` +
      `- <보기> 유형: 먼저 kind:content로 보기 항목을 ㄱ, ㄴ, ㄷ, ㄹ 기호로 나열(text 예: "ㄱ. …\\nㄴ. …\\nㄷ. …")하고, 이어서 그 보기를 참조하는 kind:choice 문항을 둔다.\n` +
      `- "<보기>에서 옳은 것을 있는 대로 고른 것은?" 유형의 선지(options)에는 보기 기호 조합만 넣는다. 예: ["ㄱ","ㄴ","ㄱ, ㄴ","ㄱ, ㄷ","ㄱ, ㄴ, ㄷ"]. 선지에 문장 설명을 넣지 말 것.\n` +
      `- 그 외 일반 객관식 선지는 간결하고 자연스러운 한국어 명사구/짧은 문장으로.\n` +
      `자료 이해·적용·자기생각을 고루 섞고, 정답은 쓰지 마세요. JSON 외의 설명은 절대 붙이지 마세요.` +
      extra,
  });

  return content;
}

const SYSTEM = [
  "너는 교사가 올린 수업 자료를 분석해, 오직 그 자료 안의 정보만으로 학생 활동(제시 블록 + 문항)을 설계하는 조력자다.",
  "절대 규칙: 제시된 자료 안에 실제로 있는 내용으로만 문항·보기·선지를 만든다. 자료에 없는 배경지식·상식·외부 정보·추측은 절대 쓰지 않는다.",
  "학생이 그 자료만 보고 답할 수 있어야 한다. 자료가 부실해 근거 있는 문항을 만들 수 없으면, 문항 수를 줄이거나 만들지 않는다(억지로 지어내지 않는다).",
  "출제 형식은 한국 학교 시험 관행을 따른다: 시험체 어투, <보기>는 ㄱ·ㄴ·ㄷ 기호로, '있는 대로 고른 것은?'류의 선지는 기호 조합(예: ㄱ, ㄴ)만 넣는다.",
  "교사의 추가 요청은 자료 범위 안에서 반영한다. 정답은 쓰지 않는다. 한국어로, 반드시 JSON 배열만 출력한다.",
].join("\n");

function parseItems(raw: string, choiceCount: number): GeneratedItem[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: GeneratedItem[] = [];
  for (const item of parsed.slice(0, MAX_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    if (r.kind === "content") {
      const text = typeof r.text === "string" ? r.text.trim().slice(0, 4000) : "";
      if (!text) continue;
      const label =
        typeof r.label === "string" ? r.label.trim().slice(0, 80) : undefined;
      out.push({ kind: "content", label, text });
      continue;
    }

    // default to a field
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 400) : "";
    if (!label) continue;
    const type: FieldType =
      r.type === "long" || r.type === "choice" || r.type === "number"
        ? r.type
        : "short";
    let options: string[] | undefined;
    if (type === "choice") {
      options = Array.isArray(r.options)
        ? r.options
            .filter((o): o is string => typeof o === "string")
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, Math.max(2, choiceCount))
        : [];
    }
    out.push({ kind: "field", type, label, options });
  }
  return out;
}

export interface GenerateResult {
  items: GeneratedItem[];
  /** Per-link diagnosis, so the UI can explain an empty result truthfully. */
  linkNotes: LinkNote[];
}

export async function generateItems(
  materials: SourceMaterial[],
  opts: GenerateOptions,
): Promise<GenerateResult | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  if (materials.length === 0) return { items: [], linkNotes: [] };

  const linkNotes: LinkNote[] = [];
  const readable = { count: 0 };
  const content = await buildContent(materials, opts, linkNotes, readable);
  // 읽어낸 자료가 하나도 없으면 모델을 호출하지 않는다. 근거가 전혀 없는데도
  // 모델이 그럴듯한 문항을 지어내는 일이 실제로 관측됐다(자막 없는 영상 1건에
  // 문항 1개 생성). "근거 없으면 출제하지 않는다"는 프롬프트 지시에만 맡기지
  // 않고 코드로 막는다.
  if (readable.count === 0) return { items: [], linkNotes };
  try {
    const res = await client.messages.create({
      model: MODEL_ID[opts.tier] ?? MODEL_ID.fast,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { items: parseItems(text, opts.choiceCount), linkNotes };
  } catch {
    return null;
  }
}
