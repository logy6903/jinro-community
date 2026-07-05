import Link from "next/link";
import { NewMaterialForm } from "@/components/NewMaterialForm";

export default function NewMaterialPage() {
  return (
    <div className="flex flex-col gap-5">
      <Link href="/board" className="text-sm text-muted hover:text-foreground">
        ← 게시판으로
      </Link>
      <h1 className="text-xl font-bold">자료 올리기</h1>
      <NewMaterialForm />
    </div>
  );
}
