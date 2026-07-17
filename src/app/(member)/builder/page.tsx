import { AppBuilder } from "@/components/builder/AppBuilder";
import { TeacherGate } from "@/components/builder/TeacherGate";

// Teacher workspace: create student-facing apps and see the ones you've made.
// Access is gated by TeacherGate (Google sign-in → 진로교사 프로필 온보딩).

export default function BuilderPage() {
  return (
    <TeacherGate>
      <AppBuilder />
    </TeacherGate>
  );
}
