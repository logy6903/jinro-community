import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sa = JSON.parse(readFileSync(path.join(ROOT, "service-account.json"), "utf8"));
const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key }) });
const db = getFirestore(app);

const mode = process.argv[2];
if (mode === "del") {
  await db.collection("datasets").doc(process.argv[3]).delete();
  console.log("deleted", process.argv[3]);
} else {
  const columns = ["대학", "모집단위", "수능최저", "논술유형"];
  const rows = [
    ["가천대", "컴퓨터공학", "미적용", "수리논술"],
    ["경희대", "한의예", "3합4", "인문+자연"],
    ["중앙대", "의학부", "4합5", "자연논술"],
  ];
  const ref = await db.collection("datasets").add({
    title: "2027 수도권 논술 수능최저 정리",
    category: "essay",
    schoolLevel: "high",
    year: "2027",
    source: "각 대학 입학처 (테스트)",
    customFields: [{ key: "지역", value: "수도권" }],
    authorUid: "test-uid",
    authorName: "테스트 교사",
    columns,
    rowsJson: JSON.stringify(rows),
    rowCount: rows.length,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log("ID:" + ref.id);
}
process.exit(0);
