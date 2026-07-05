// NEIS-style byte counting for 생활기록부 (생기부) length limits. Pure + no
// server deps, so it is safe to import from both server code and client
// components (the record editor shows a live byte count as the teacher edits).
//
// Approximate NEIS rule: 한글/기타 다바이트 = 3 bytes, ASCII = 1 byte,
// 줄바꿈(엔터) = 2 bytes. This matches the count teachers see in NEIS closely
// but may differ by a byte or two from the exact spec — treat it as guidance.

export function neisByteLength(s: string): number {
  let bytes = 0;
  for (const ch of s) {
    if (ch === "\n") bytes += 2;
    else if ((ch.codePointAt(0) ?? 0) <= 0x7f) bytes += 1;
    else bytes += 3;
  }
  return bytes;
}

/**
 * Truncate a string to at most `max` bytes, backing up to the last sentence
 * boundary when one is reasonably close so the result doesn't end mid-word.
 */
export function truncateToBytes(s: string, max: number): string {
  if (neisByteLength(s) <= max) return s;

  const chars = [...s];
  // Binary search for the longest character prefix within the byte budget.
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (neisByteLength(chars.slice(0, mid).join("")) <= max) lo = mid;
    else hi = mid - 1;
  }

  let out = chars.slice(0, lo).join("");
  const dot = out.lastIndexOf(".");
  if (dot > out.length * 0.6) out = out.slice(0, dot + 1);
  return out.trim();
}
