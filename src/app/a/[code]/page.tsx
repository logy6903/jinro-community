import { notFound } from "next/navigation";
import { getAppByCode } from "@/lib/builder/repository";
import { StudentForm } from "@/components/builder/StudentForm";

// Public student-facing app at /a/{code}. One engine renders any app's config
// as a form — there is no per-app deployment. The code is looked up server-side;
// the interactive form + submit is a client component.

export default async function StudentAppPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const app = await getAppByCode(code);
  if (!app) notFound();

  return <StudentForm app={app} />;
}
