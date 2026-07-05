import {
  getRosterById,
  sanitizeRosterInput,
  updateRoster,
} from "@/lib/builder/rosterRepository";
import { verifyRequestUser } from "@/lib/builder/auth";

// GET  /api/builder/rosters/:id — one roster (owner-only).
// POST /api/builder/rosters/:id — overwrite name/school/students (owner-only).

export async function GET(
  req: Request,
  ctx: RouteContext<"/api/builder/rosters/[id]">,
) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const { id } = await ctx.params;
  const roster = await getRosterById(id);
  if (!roster) return Response.json({ error: "not_found" }, { status: 404 });
  if (roster.ownerUid !== user.uid) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  return Response.json({ roster });
}

export async function POST(
  req: Request,
  ctx: RouteContext<"/api/builder/rosters/[id]">,
) {
  const user = await verifyRequestUser(req);
  if (!user) return Response.json({ error: "auth_required" }, { status: 401 });

  const { id } = await ctx.params;
  const roster = await getRosterById(id);
  if (!roster) return Response.json({ error: "not_found" }, { status: 404 });
  if (roster.ownerUid !== user.uid) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const input = sanitizeRosterInput(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid_input" }, { status: 400 });

  const ok = await updateRoster(id, input);
  if (!ok) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true });
}
