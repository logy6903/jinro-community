// Client-safe helpers for embedding content blocks (no server deps).

import type { Block, ContentBlock } from "./types";

/** What an embeddable URL should look like on screen. */
export type EmbedKind = "video" | "doc";

export interface Embed {
  kind: EmbedKind;
  src: string;
}

/**
 * If `input` is a YouTube link (in any common form), return its /embed/ URL so
 * it can be played inline in an <iframe>. Returns null for non-YouTube URLs.
 *
 * Handles: https/http or no protocol; www./m./nocookie; youtu.be/<id>;
 * /watch?v=<id>; /embed/<id>; /shorts/<id>; /live/<id>; extra query params.
 */
export function youtubeEmbedUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const u = new URL(withProto);
    const host = u.hostname.replace(/^www\./, "");
    let id = "";

    if (host === "youtu.be") {
      id = u.pathname.slice(1);
    } else if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtube-nocookie.com"
    ) {
      if (u.pathname === "/watch") {
        id = u.searchParams.get("v") ?? "";
      } else {
        const parts = u.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) {
          id = parts[1] ?? "";
        }
      }
    }

    id = id.split(/[?&/]/)[0];
    return /^[\w-]{6,}$/.test(id)
      ? `https://www.youtube.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}

/**
 * Google Docs-family share link → its embeddable form. Teachers routinely hand
 * out 구글 슬라이드 for class material, so a pasted /edit link should play
 * inline rather than kick the student out to another tab.
 */
export function googleDocsEmbedUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const u = new URL(withProto);
    if (u.hostname.replace(/^www\./, "") !== "docs.google.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    // /presentation/d/<id>/edit  ·  /document/d/<id>/...  ·  /spreadsheets/d/<id>/...
    const app = parts[0] ?? "";
    if (!["presentation", "document", "spreadsheets"].includes(app)) return null;
    if (parts[1] !== "d") return null;
    const id = parts[2] ?? "";
    if (!/^[\w-]{10,}$/.test(id)) return null;
    return app === "presentation"
      ? `https://docs.google.com/presentation/d/${id}/embed`
      : `https://docs.google.com/${app}/d/${id}/preview`;
  } catch {
    return null;
  }
}

/**
 * Office file (ppt/pptx/doc/docx/xls/xlsx) → Microsoft's public Office viewer,
 * which renders it as an inline page. The file URL must be publicly reachable —
 * Firebase Storage download URLs (with their ?token=) are.
 *
 * NOTE: this hands the file's URL to Microsoft's viewer service to fetch, so it
 * suits ordinary class material, not confidential documents.
 */
export function officeEmbedUrl(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(raw)}`;
}

/**
 * Resolve any `link` content value to something embeddable (YouTube video or a
 * Google Docs-family document). Null when it's an ordinary link that should
 * just be shown as a hyperlink.
 */
export function linkEmbed(input: string): Embed | null {
  const yt = youtubeEmbedUrl(input);
  if (yt) return { kind: "video", src: yt };
  const g = googleDocsEmbedUrl(input);
  if (g) return { kind: "doc", src: g };
  return null;
}

/**
 * Does this block occupy the 자료 pane? Media (영상·문서·이미지) is what a
 * student needs to keep looking at *while* answering, so it gets pinned beside
 * the questions. Plain text content (AI-generated <보기>, 지시문) stays inline
 * with the question it belongs to.
 */
export function isMediaContent(block: Block): block is ContentBlock {
  if (block.kind !== "content") return false;
  if (block.contentType === "text") return false;
  // A non-embeddable plain link is just a hyperlink — not worth a pane.
  if (block.contentType === "link") return linkEmbed(block.value) !== null;
  return true;
}
