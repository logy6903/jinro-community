// Collect external info items from RSS sources into Firestore external_feed.
//
//   npm run collect
//
// Ported from kakao-daily/src/feeds.mjs (RSS press-release parser). Self-
// contained (no TS imports) so it runs on plain node. Idempotent: each item is
// keyed by a hash of its url, upserted with merge. Run periodically (later: a
// scheduled GitHub Action, like kakao-daily).

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAYS = 30;

// --- credentials (service-account.json) ---
const sa = JSON.parse(readFileSync(path.join(ROOT, "service-account.json"), "utf8"));
const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key,
      }),
    });
const db = getFirestore(app);

const sources = JSON.parse(
  readFileSync(path.join(ROOT, "src", "lib", "feed", "sources.json"), "utf8"),
);

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#0?39;/g, "'")
    .replace(/&middot;/g, "·")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    // RSS often double-encodes (&amp;middot;) — decode once more for those.
    .replace(/&middot;/g, "·");
}

function tag(block, name) {
  const m = block.match(
    new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`),
  );
  return m ? decodeEntities(m[1].trim()) : "";
}

async function fetchSource(source) {
  const items = [];
  const res = await fetch(source.url);
  const xml = await res.text();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = tag(block, "title");
    const link = tag(block, "link");
    const pub = tag(block, "pubDate");
    if (!title || !pub) continue;
    const date = new Date(pub);
    if (isNaN(date.getTime()) || Date.now() - date.getTime() > DAYS * 86400000) continue;
    items.push({
      source: source.name,
      title,
      url: link,
      publishedAt: date.toISOString(),
    });
  }
  return items;
}

const collectedAt = new Date().toISOString();
let upserted = 0;
for (const source of sources) {
  try {
    const items = await fetchSource(source);
    for (const item of items) {
      const id = createHash("sha1").update(item.url || item.title).digest("hex").slice(0, 24);
      await db
        .collection("external_feed")
        .doc(id)
        .set({ id, ...item, collectedAt }, { merge: true });
      upserted += 1;
    }
    console.log(`  ✓ ${source.name}: ${items.length}건`);
  } catch (err) {
    console.warn(`  ✗ ${source.name}: ${err.message}`);
  }
}
console.log(`\n총 ${upserted}건을 external_feed 에 upsert 했습니다.`);
process.exit(0);
