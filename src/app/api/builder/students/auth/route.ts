import { getAppByCode } from "@/lib/builder/repository";
import { getAccount, verifyPassword } from "@/lib/builder/studentAuth";

// POST /api/builder/students/auth — LOGIN. { code, loginId, password }.
// Verifies the account and resolves whether it's already enrolled in this app's
// class (so the UI knows to prompt for this year's 학번 if it isn't yet).

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    loginId?: unknown;
    password?: unknown;
  } | null;
  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.loginId !== "string" ||
    typeof body.password !== "string"
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const app = await getAppByCode(body.code);
  if (!app || !app.rosterId) {
    return Response.json({ error: "no_roster" }, { status: 404 });
  }

  const account = await getAccount(body.loginId);
  if (!account || !verifyPassword(body.password, account.password)) {
    return Response.json({ error: "bad_login" }, { status: 401 });
  }

  const studentNo = account.enrollments[app.rosterId] ?? "";
  return Response.json({
    name: account.name,
    enrolled: studentNo !== "",
    studentNo,
  });
}
