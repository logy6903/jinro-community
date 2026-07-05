import { getAdminAuth } from "../firebase/admin";

// Shared request-auth for builder routes. Mirrors the inline token check used by
// the materials/cards routes, factored out because several builder routes need
// it. The user identity always comes from the verified token, never the body.

export interface RequestUser {
  uid: string;
  name: string;
}

export async function verifyRequestUser(
  req: Request,
): Promise<RequestUser | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const adminAuth = getAdminAuth();
  if (!token || !adminAuth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, name: decoded.name ?? decoded.email ?? "익명" };
  } catch {
    return null;
  }
}
