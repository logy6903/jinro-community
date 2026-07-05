import { getAppByCode } from "@/lib/builder/repository";
import { getRosterById } from "@/lib/builder/rosterRepository";
import { getClaimOwner } from "@/lib/builder/studentAuth";

// POST /api/builder/students/check — { code, studentNo }.
// Registration step: is this 학번 a member of the app's class, its name (from the
// roster), and whether it's already claimed by an account.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    code?: unknown;
    studentNo?: unknown;
  } | null;
  if (
    !body ||
    typeof body.code !== "string" ||
    typeof body.studentNo !== "string"
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const app = await getAppByCode(body.code);
  if (!app || !app.rosterId) {
    return Response.json({ error: "no_roster" }, { status: 404 });
  }
  const roster = await getRosterById(app.rosterId);
  if (!roster) return Response.json({ error: "no_roster" }, { status: 404 });

  const studentNo = body.studentNo.trim();
  const member = roster.students.find((s) => s.studentNo === studentNo);
  if (!member) return Response.json({ inRoster: false });

  const owner = await getClaimOwner(app.rosterId, studentNo);
  return Response.json({
    inRoster: true,
    name: member.name,
    claimed: owner !== null,
  });
}
