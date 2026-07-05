import {
  createApp,
  listAppsByOwner,
  sanitizeAppInput,
} from "@/lib/builder/repository";
import { verifyRequestUser } from "@/lib/builder/auth";

// GET  /api/builder/apps — the signed-in teacher's own apps.
// POST /api/builder/apps — create an app from a field config. Owner is taken
//   from the verified token; returns { id, code } (code → student URL /a/{code}).

export async function GET(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });
  const apps = await listAppsByOwner(user.uid);
  return Response.json({ apps });
}

export async function POST(req: Request) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const input = sanitizeAppInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const created = await createApp(input, user);
  if (!created) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json(created);
}
