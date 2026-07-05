import {
  createSubmission,
  getAppByCode,
  sanitizeAnswers,
} from "@/lib/builder/repository";
import { getAccount, verifyPassword } from "@/lib/builder/studentAuth";
import { runAiBlocks } from "@/lib/builder/ai";

// POST /api/builder/submit — a student submits answers to an app.
// Open apps: free-typed 학번+이름. Roster apps: 아이디+비밀번호 are re-verified
// server-side (계정화). Identity = the stable account id; the name comes from the
// account and the 학번 from that account's enrollment in this class — a spoofed
// body can't impersonate anyone. AI blocks run here; the key stays server-side.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    studentName?: unknown;
    studentNo?: unknown;
    loginId?: unknown;
    password?: unknown;
    answers?: unknown;
  } | null;

  if (!body || typeof body.code !== "string") {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const app = await getAppByCode(body.code);
  if (!app) return Response.json({ error: "not_found" }, { status: 404 });

  // Submission window (server-enforced).
  const now = Date.now();
  if (app.openAt && now < new Date(app.openAt).getTime()) {
    return Response.json({ error: "not_open" }, { status: 403 });
  }
  if (app.closeAt && now > new Date(app.closeAt).getTime()) {
    return Response.json({ error: "closed" }, { status: 403 });
  }

  // Identity.
  let studentName =
    typeof body.studentName === "string" ? body.studentName : "";
  let studentNo = typeof body.studentNo === "string" ? body.studentNo : "";
  let studentId = "";
  if (app.rosterId) {
    const loginId = typeof body.loginId === "string" ? body.loginId : "";
    const password = typeof body.password === "string" ? body.password : "";
    const account = await getAccount(loginId);
    if (!account || !verifyPassword(password, account.password)) {
      return Response.json({ error: "auth_required" }, { status: 401 });
    }
    const no = account.enrollments[app.rosterId];
    if (!no) return Response.json({ error: "not_enrolled" }, { status: 403 });
    studentId = account.loginId;
    studentName = account.name;
    studentNo = no;
  }

  const answers = sanitizeAnswers(app, body.answers);
  if (!answers) {
    return Response.json({ error: "invalid_answers" }, { status: 400 });
  }

  const aiOutputs = await runAiBlocks(app, answers);

  const id = await createSubmission(
    app.id,
    studentName,
    studentNo,
    studentId,
    answers,
    aiOutputs,
  );
  if (!id) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }

  const feedback = app.aiBlocks
    .filter((b) => b.showToStudent && aiOutputs[b.id])
    .map((b) => ({ title: b.title, text: aiOutputs[b.id] }));

  return Response.json({ id, feedback });
}
