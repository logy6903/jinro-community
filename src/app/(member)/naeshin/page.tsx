import { NaeshinQA } from "@/components/NaeshinQA";
import { listSpecs } from "@/lib/naeshin/repository";
import { listSources } from "@/lib/sources/repository";
import { SKKU_2026_HAKJANG } from "@/lib/naeshin/specs/skku-2026-hakjang";

// 내신 산출 검수. 서버가 저장된 spec + 요강 소스를 불러오고, 클라이언트에서
// 요강 추출 → 트레이스 검증·수식 편집 → 저장까지 한 화면에서 돈다.
// 손인코딩 성대 spec은 seed로 항상 제공(Firestore 비어도 검증 가능).

export default async function NaeshinPage() {
  const [persisted, sources] = await Promise.all([listSpecs(), listSources()]);
  // seed와 중복(같은 id) 저장본은 제외.
  const filtered = persisted.filter((s) => s.id !== SKKU_2026_HAKJANG.id);
  return (
    <NaeshinQA seed={SKKU_2026_HAKJANG} persisted={filtered} sources={sources} />
  );
}
