// Client-safe helpers for embedding content blocks (no server deps).

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
