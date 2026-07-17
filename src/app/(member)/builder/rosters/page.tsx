import { RosterManager } from "@/components/builder/RosterManager";
import { TeacherGate } from "@/components/builder/TeacherGate";

// Class roster (명렬) management. Gated by TeacherGate (sign-in → 교사 프로필).

export default function RostersPage() {
  return (
    <TeacherGate>
      <RosterManager />
    </TeacherGate>
  );
}
