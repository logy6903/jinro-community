// 대학 요강 PDF 수집기 — sourceUrl에서 받아 Firebase Storage(originals/{id}.pdf)에
// 업로드하고 docs/univ-guides.json 에 결과 기록.
//
// 해시 비교: 이미 올린 파일과 내용(sha256)이 같으면 스킵(unchanged) — 재실행/시즌
//   재수집 때 "바뀐 것만" 갱신.
// 리더 트리거: `node collect-univ-guides.mjs bellwether` → bellwether:true 대학(리더)만
//   먼저 확인, 하나라도 변경/신규면 나머지 전체를 이어서 스윕. 없으면 종료.
//   (매일은 이 모드로 — 리더 5곳만 두드리고, 요강 시즌에 리더가 바뀌면 전체 수집)
// `node collect-univ-guides.mjs all`(기본) → 전체 강제 수집.
//
// status: ok(업로드됨/현행) · updated(이번에 갱신) · unchanged(동일) · check(의심) · fail(실패)
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(fs.readFileSync(path.join(ROOT, "service-account.json"), "utf8"));
const bucketName =
  process.env.FIREBASE_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  `${sa.project_id}.firebasestorage.app`;
const app = initializeApp({
  credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }),
  storageBucket: bucketName,
});
const bucket = getStorage(app).bucket();

const metaPath = path.join(ROOT, "docs", "univ-guides.json");
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const mode = process.argv[2] || "all";

function download(url, redirects = 5) {
  try { url = new URL(url).href; } catch { /* leave as-is */ } // 공백·한글 raw URL 자동 인코딩(기존 %xx는 보존)
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("http://") ? http : https;
    const req = mod.get(url, { rejectUnauthorized: false, headers: { "User-Agent": "Mozilla/5.0" } }, (r) => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location && redirects > 0) {
        r.resume();
        return resolve(download(new URL(r.headers.location, url).toString(), redirects - 1));
      }
      if (r.statusCode !== 200) { r.resume(); return resolve({ status: r.statusCode, buffer: null }); }
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => resolve({ status: 200, buffer: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("timeout")));
  });
}

/** 1건 처리. 반환: "updated" | "unchanged" | "check" | "fail". */
async function processOne(it) {
  if (!it.sourceUrl) { it.status = "fail"; it.note = "sourceUrl 없음"; return "fail"; }
  let res;
  try {
    res = await download(it.sourceUrl);
  } catch (e) {
    it.status = "fail"; it.note = e.message.slice(0, 50); console.log(`❌ ${it.university}: ${it.note}`); return "fail";
  }
  if (!res.buffer) { it.status = "fail"; it.note = `HTTP ${res.status}`; console.log(`❌ ${it.university}: HTTP ${res.status}`); return "fail"; }
  const buf = res.buffer;
  const isPdf = buf.slice(0, 5).toString("latin1").startsWith("%PDF");
  const mb = +(buf.length / 1048576).toFixed(1);
  if (!isPdf || buf.length < 300 * 1024) {
    it.status = "check"; it.note = `의심: ${isPdf ? "" : "PDF헤더X "}${mb}MB`; console.log(`⚠️ ${it.university}: ${it.note}`); return "check";
  }
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  if (it.contentHash === hash && it.originalPath) {
    it.status = "ok"; delete it.note; console.log(`· ${it.university}: 동일(unchanged)`); return "unchanged";
  }
  const objPath = `originals/${it.id}.pdf`;
  const token = it.downloadToken || crypto.randomUUID();
  await bucket.file(objPath).save(buf, {
    resumable: false, contentType: "application/pdf",
    metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
  });
  const wasNew = !it.originalPath;
  it.originalPath = objPath;
  it.downloadToken = token;
  it.publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(objPath)}?alt=media&token=${token}`;
  it.contentHash = hash;
  it.sizeMB = mb;
  it.status = "ok";
  delete it.note;
  console.log(`✅ ${it.university}: ${mb}MB ${wasNew ? "(신규)" : "(갱신)"}`);
  return "updated";
}

async function run(items) {
  const c = { updated: 0, unchanged: 0, check: 0, fail: 0 };
  for (const it of items) c[await processOne(it)]++;
  return c;
}

let leaders = meta.items.filter((i) => i.bellwether);
let rest = meta.items.filter((i) => !i.bellwether);
let summary;

if (mode === "bellwether") {
  console.log(`=== 리더 ${leaders.length}곳 확인 ===`);
  const lc = await run(leaders);
  const changed = lc.updated;
  if (changed > 0) {
    console.log(`\n★ 리더 ${changed}곳 변경 감지 → 전체 스윕 (${rest.length}곳)`);
    const rc = await run(rest);
    summary = { updated: lc.updated + rc.updated, unchanged: lc.unchanged + rc.unchanged, check: lc.check + rc.check, fail: lc.fail + rc.fail };
  } else {
    console.log("리더 변경 없음 → 전체 스윕 생략");
    summary = lc;
  }
} else {
  summary = await run(meta.items);
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
console.log(`\n=== 결과: 갱신${summary.updated} 동일${summary.unchanged} 의심${summary.check} 실패${summary.fail} ===`);
process.exit(0);
