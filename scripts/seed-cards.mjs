// One-off: push the in-memory seed cards into Firestore.
//
//   npm run seed         (= node --experimental-strip-types scripts/seed-cards.mjs)
//
// Credentials: prefer service-account.json in the project root, else
// FIREBASE_ADMIN_* from .env.local. Idempotent: writes each card by its id with
// merge, so re-running overwrites cleanly. Node's type stripping lets us import
// the .ts seed directly — no build step.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local (simple parser; no dependency).
for (const file of [".env.local", ".env"]) {
  try {
    const text = readFileSync(path.join(ROOT, file), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {}
}

function loadServiceAccount() {
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(ROOT, "service-account.json");
  try {
    const json = JSON.parse(readFileSync(filePath, "utf8"));
    if (json.project_id && json.client_email && json.private_key) {
      return {
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      };
    }
  } catch {}
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

const creds = loadServiceAccount();
if (!creds) {
  console.error(
    "Firebase 자격증명이 없습니다. service-account.json 을 프로젝트 루트에 두거나 .env.local 의 FIREBASE_ADMIN_* 를 채우세요.",
  );
  process.exit(1);
}

const { CARDS } = await import("../src/lib/content/cards.ts");

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(creds) });
const db = getFirestore(app);

let n = 0;
for (const card of CARDS) {
  await db.collection("content_cards").doc(card.id).set(card, { merge: true });
  n += 1;
  console.log(`  ✓ ${card.id}`);
}
console.log(`\n${n}개 카드를 Firestore content_cards 컬렉션에 올렸습니다.`);
process.exit(0);
