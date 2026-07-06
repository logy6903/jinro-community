import { RecordMaker } from "@/components/builder/RecordMaker";
import { TeacherGate } from "@/components/builder/TeacherGate";

// Bulk 생활기록부 generation across a semester's assignments. Gated by
// TeacherGate (sign-in → 교사 프로필).

export default function RecordsPage() {
  return (
    <TeacherGate>
      <RecordMaker />
    </TeacherGate>
  );
}
