import { readFileSync } from "node:fs";
import path from "node:path";
import {
  cert,
  getApps,
  initializeApp,
  type App,
  type Credential,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

// Server-side Firebase Admin. Used by the content repository for Firestore
// reads/writes in server components and route handlers.
//
// Per the moon2 convention, each app owns its OWN Firebase project (독립 DB) —
// jinro-community must point at its own project, not a shared one.
//
// Credentials are loaded in this order:
//   1. A service-account.json file in the project root (gitignored) — easiest;
//      just drop the file Firebase gives you, no copy-pasting the secret key.
//   2. FIREBASE_ADMIN_* env vars (for Vercel / CI, where a file isn't handy).
// When neither is present everything returns null and the app falls back to the
// in-memory seed, so it keeps running before Firebase is wired.

let cached: Firestore | null | undefined;

function loadCredential(): Credential | null {
  // 1) Local JSON file (default: <project root>/service-account.json).
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(process.cwd(), "service-account.json");
  try {
    const json = JSON.parse(readFileSync(filePath, "utf8"));
    if (json.project_id && json.client_email && json.private_key) {
      return cert({
        projectId: json.project_id,
        clientEmail: json.client_email,
        privateKey: json.private_key,
      });
    }
  } catch {
    // no file (or unreadable) — fall through to env vars
  }

  // 2) Discrete env vars. Vercel/CI store the key with literal "\n".
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  return null;
}

function initAdminApp(): App | null {
  if (getApps().length) return getApps()[0];
  const credential = loadCredential();
  return credential ? initializeApp({ credential }) : null;
}

/** Firestore handle, or null when Admin credentials are not configured. */
export function getAdminDb(): Firestore | null {
  if (cached !== undefined) return cached;
  const app = initAdminApp();
  cached = app ? getFirestore(app) : null;
  return cached;
}

/** Whether server-side Firestore is available this runtime. */
export function isFirestoreConfigured(): boolean {
  return getAdminDb() !== null;
}

/** Admin Auth handle (for verifying client ID tokens), or null if unconfigured. */
export function getAdminAuth(): Auth | null {
  const app = initAdminApp();
  return app ? getAuth(app) : null;
}

/** Storage bucket handle for large originals (PDFs), or null if unconfigured.
 * Bucket name from FIREBASE_STORAGE_BUCKET / NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET. */
export function getAdminBucket(): ReturnType<Storage["bucket"]> | null {
  const app = initAdminApp();
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!app || !bucketName) return null;
  return getStorage(app).bucket(bucketName);
}
