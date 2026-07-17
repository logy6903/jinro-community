import { AppDashboard } from "@/components/builder/AppDashboard";
import { TeacherGate } from "@/components/builder/TeacherGate";

// Teacher dashboard for one app: share link + collected submissions.
// Gated by TeacherGate (sign-in → 교사 프로필); dashboard also owner-checks.

export default async function BuilderAppPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TeacherGate>
      <AppDashboard appId={id} />
    </TeacherGate>
  );
}
