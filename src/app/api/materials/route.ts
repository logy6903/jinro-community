import { createMaterial, sanitizeInput } from "@/lib/materials/repository";
import { getAdminAuth } from "@/lib/firebase/admin";

// POST /api/materials — create a teacher-contributed material.
// Requires a Firebase ID token; the author is taken from the verified token,
// never trusted from the body.

export async function POST(req: Request) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const adminAuth = getAdminAuth();
  if (!token || !adminAuth) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  let uid: string;
  let name: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    uid = decoded.uid;
    name = decoded.name ?? decoded.email ?? "익명";
  } catch {
    return Response.json({ error: "invalid_token" }, { status: 401 });
  }

  const input = sanitizeInput(await req.json().catch(() => null));
  if (!input) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const id = await createMaterial(input, { uid, name });
  if (!id) {
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return Response.json({ id });
}
