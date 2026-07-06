import {
  createRoster,
  listRostersByOwner,
  sanitizeRosterInput,
} from "@/lib/builder/rosterRepository";
import { verifyRequestUser } from "@/lib/builder/auth";
import { hasTeacherProfile } from "@/lib/builder/teacherProfile";

// GET  /api/builder/rosters — the teacher's own rosters.
// POST /api/builder/rosters — create a roster. Owner from the verified token.

export async function GET(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  const rosters = await listRostersByOwner(user.uid);
  return Response.json({ rosters });
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  if (!(await hasTeacherProfile(user.uid))) {
    return Response.json({ error: "profile_required" }, { status: 403 });
  }

  const input = sanitizeRosterInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const id = await createRoster(input, user);
  if (!id) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ id });
}
