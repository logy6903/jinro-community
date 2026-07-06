import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "./anthropic";
import type { AiModelTier, ContentType, FieldType } from "./types";

// Draft-stage AI: read the materials a teacher has put on an app (제시 자료) and
// propose student questions from them. This runs once at authoring time (teacher
// side), not per student, so cost is negligible — Haiku by default, Opus opt-in.
// Images and PDFs are fetched server-side and sent to Claude as vision/document
// blocks so it reads the actual worksheet, not just a caption.

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

export interface SourceMaterial {
  contentType: ContentType;
  /** text: the body; image/pdf/link: the URL. */
  value: string;
  label?: string;
}

export interface GeneratedQuestion {
  type: FieldType;
  label: string;
  options?: string[];
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

// Build the multimodal user content: an intro, each material as the right block,
// then the output instruction. Unreadable assets degrade to a text note.
async function buildContent(
  materials: SourceMaterial[],
  count: number,
): Promise<Anthropic.ContentBlockParam[]> {
  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: "다음은 교사가 학생에게 제시한 수업 자료입니다. 이 자료들을 바탕으로 학생이 답할 문항을 만들어 주세요.",
    },
  ];

  for (const m of materials) {
    const caption = m.label?.trim() ? `[자료: ${m.label.trim()}]` : "[자료]";
    if (m.contentType === "text") {
      content.push({ type: "text", text: `${caption}\n${m.value}` });
    } else if (m.contentType === "link") {
      content.push({
        type: "text",
        text: `${caption} (링크: ${m.value})\n※ 링크(영상 등)의 내부 내용은 직접 볼 수 없으니 제목·주제를 참고해 일반적인 문항을 만드세요.`,
      });
    } else if (m.contentType === "image") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched && (IMAGE_TYPES as readonly string[]).includes(fetched.mediaType)) {
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
        content.push({ type: "text", text: `${caption} (이미지 자료 — 열 수 없어 제목만 참고)` });
      }
    } else if (m.contentType === "pdf") {
      const fetched = await fetchAsBase64(m.value);
      if (fetched) {
        content.push({ type: "text", text: caption });
        content.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fetched.data },
        });
      } else {
        content.push({ type: "text", text: `${caption} (PDF 자료 — 열 수 없어 제목만 참고)` });
      }
    }
  }

  content.push({
    type: "text",
    text:
      `위 자료를 바탕으로 학생용 문항 ${count}개를 만들어 주세요. ` +
      "형식은 오직 JSON 배열로만 출력하고, 다른 설명은 절대 붙이지 마세요. " +
      '각 원소는 {"type": "short"|"long"|"choice", "label": "문항 텍스트", "options": ["보기1","보기2"]} 형태입니다. ' +
      "options는 type이 choice일 때만 포함합니다. 단답은 short, 서술형은 long을 쓰고, 자료 이해·적용·자기생각을 고루 섞으세요.",
  });

  return content;
}

const SYSTEM = [
  "너는 교사의 수업 자료를 읽고 학생용 문항을 설계하는 조력자다.",
  "규칙: 한국어로, 학생 수준에 맞게, 자료에 근거한 문항만 만든다. 정답은 쓰지 않는다.",
  "자료가 여러 개면 종합해서 문항을 구성한다. 반드시 JSON 배열만 출력한다.",
].join("\n");

function parseQuestions(raw: string): GeneratedQuestion[] {
  // Strip code fences / prose the model may wrap around the JSON.
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
  const out: GeneratedQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const label = typeof r.label === "string" ? r.label.trim().slice(0, 200) : "";
    if (!label) continue;
    const type: FieldType =
      r.type === "long" || r.type === "choice" || r.type === "number"
        ? r.type
        : "short";
    const options =
      type === "choice" && Array.isArray(r.options)
        ? r.options
            .filter((o): o is string => typeof o === "string")
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 8)
        : undefined;
    out.push({ type, label, options });
  }
  return out;
}

export async function generateQuestions(
  materials: SourceMaterial[],
  count: number,
  tier: AiModelTier,
): Promise<GeneratedQuestion[] | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  if (materials.length === 0) return [];

  const content = await buildContent(materials, count);
  try {
    const res = await client.messages.create({
      model: MODEL_ID[tier] ?? MODEL_ID.fast,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return parseQuestions(text);
  } catch {
    return null;
  }
}
