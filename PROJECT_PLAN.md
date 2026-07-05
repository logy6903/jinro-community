# PROJECT_PLAN.md — 진로교사 커뮤니티

핵심 *왜*는 `CLAUDE.md`의 "확정된 핵심 결정"에 있다. 여기는 로드맵·데이터 모델·연동 계약·미해결 질문.

## 데이터 모델

현재 코드(`src/lib/domain/types.ts`)에 구현된 것은 **굵게**.

- **`ContentCard`** — id, schoolLevel(중/고), category(활동/수업/정보/체크리스트), title, summary, body, **calendarTags[]**, source, attachments?, **usedCount**. 퍼나르기 1조각.
- **`AcademicPeriod`** (= 기획서의 `calendar_rule` 최소판) — id, level, label, hint, start/end(MM-DD). 달력 엔진이 읽는 시기 테이블.
- `external_feed` (Phase 2) — 정책/입시/체험처/공모전 수집 항목. kakao-daily 스크래퍼 포팅으로 채움.
- `user` (Phase 2) — 가입자: 학교급, 지역, 구독 여부.
- `usage_signal` (Phase 2) — content_card_id × user_id. 현재 `UsedButton`은 낙관적 UI일 뿐 미저장.

## 달력 엔진 (조준 장치)

`calendar/engine.ts`는 순수 함수 상태기계: `now` → `getActivePeriods(level)` → `getActiveTags(level)`. 카드는 `calendarTags`로 시기에 묶이고, `content/query.ts#getCardsForNow`가 활성 태그와 교집합되는 카드를 `usedCount` 내림차순으로 반환. 홈과 `/api/feed`가 같은 진입점을 쓴다.

시기 재튜닝은 **`academicCalendar.ts` 테이블만 수정** — 엔진 코드 불변.

## kakao-daily 연동 계약 (느슨한 연결)

- 커뮤니티 → kakao-daily: `GET /api/feed` 가 `{ generatedAt, tracks: [{ schoolLevel, period, cards: [{id,title,summary,path,...}] }] }` 반환. kakao-daily `collect.mjs`가 source로 소비.
- kakao-daily → 커뮤니티: 외부 집계 스크래퍼(`feeds/serii/kcue/govcms.mjs`)를 `external_feed` 구현 시 포팅 후보로 재사용.
- **공유 DB 없음.** 결합도는 이 HTTP 계약 하나로 고정.

## 로드맵

### Phase 1 (MVP) — *동작 중*
- [x] 홈(시기별 추천) + 중/고 토글
- [x] 활동카드 + 상세 + 공유(Web Share/클립보드) + I&AI 귀속
- [x] 달력 엔진 최소판(수동 태깅) + 시드 카드
- [x] `/api/feed` 연동 계약
- [x] **Firestore 연결** — 카드 읽기 + `usedCount` 쓰기(admin SDK). `npm run seed`로 시드 업로드 완료. 미설정 시 시드 폴백.
- [x] **Firebase Auth(Google 로그인)** — client `AuthProvider` + 서버 ID토큰 검증(`getAdminAuth`). 양파구조 유지(콘텐츠 비로그인 공개, 로그인은 추가 레이어).
- [x] **per-teacher usage_signal 중복방지** — "써봤어요"가 `content_cards/{id}/usage/{uid}` 트랜잭션으로 1회만 카운트. dev 검증 완료(59→60, 재클릭 무증가).
- [x] **시드 카드 확충** — 14장. 중 7시기 + 고 7시기 모두 ≥1장 커버(연중 공백 없음). 달력 필터 정확성 재검증 완료.

### Phase 2 (진행 중)
- [~] **자료 공유 게시판** — 목록(`/board`)·상세(`/board/[id]`)·작성(`/board/new`) 완료. `shared_materials` 컬렉션(content_cards와 분리), 작성은 로그인 교사만(서버 토큰검증), 열람은 공개. dev 검증 완료. **남음**: 자료에도 "써봤어요"(카드와 동일 패턴), 신고/모더레이션, 첨부파일.
- [~] **외부 정보 집계 피드(`external_feed`)** — kakao-daily RSS 파서 포팅. `npm run collect`이 교육부 RSS→Firestore upsert(url 해시 dedup, 엔티티 디코드), `/feed`가 최근 30건 표시. dev 검증 완료(50건 수집). **남음**: 정기 실행(GitHub Action), RSS 출처 확대(시도교육청 등), HTML 스크래퍼(serii/kcue/govcms) 포팅, 공모전/체험처 출처, 중/고 태깅.
- [ ] 주간/월간 다이제스트 생성 + 가입자 발송
- [ ] AI 활동카드 초안 생성

### Phase 3 — 구조화 데이터 + 챗봇 (대화에서 합의된 큰 방향, 2026-06-26)

**핵심 아이디어**: 교사가 *엑셀로* 진학·진로 자료를 올리면 → DB화 → 그 위에 **근거 기반(RAG) 챗봇**이 검색·검토·확인. 데이터가 자산이자 챗봇의 해자(현장 교사 검증 > GPT 래퍼). kakao-daily는 유통 채널.

**"봉투 + 내용물" 모델 (핵심 설계)**: 전역 스키마를 강제하지 않는다. 업로드 하나 = 자기기술 데이터셋. **봉투(고정 메타: 제목·구분·학년도/시기·대상·출처·검증교사)** 만 형식 고정, **내용물(엑셀 헤더 행 = 스키마)** 은 자유. 챗봇은 봉투로 데이터셋을 찾고(2단 검색: 데이터셋 → 행), 행을 출처와 함께 인용. 여러 대학을 한 파일에 정리 = 데이터셋 1개 + `대학` 열(비교 질문에 강함).

- [~] **엑셀 업로드 파이프라인** — `datasets` 컬렉션. 브라우저 SheetJS 파싱 → 미리보기 → 확인 → 서버 검증·저장. 업로드(`/datasets/new`)는 로그인 교사, 열람(`/datasets`, `/datasets/[id]`)은 공개. dev 검증 완료(여러 대학 정리본 렌더). **멀티시트** = 시트 드롭다운으로 하나 골라 import(시트 1개=데이터셋 1개); 전 시트 일괄 생성은 추후. **상한**: 1파일 500행·40열(초과분 잘림, 추후 서브컬렉션). 행은 `rowsJson` 직렬화(Firestore 중첩배열 불가).
- [x] **봉투 추가칸(customFields)** — 핵심칸(제목·구분·대상·시기·출처, 라우팅의 척추)은 고정, 그 위에 교사가 자유 key:value 태그 추가(지역·난이도 등). 기존 필드명 `listCustomFieldKeys()` → `<datalist>` 자동완성으로 수렴 유도. 업로드 폼·상세 표시·검증(최대 12개) 완료. "파일 전체 속성=봉투 추가칸 / 행마다 다름=본문 열" 구분.
- [x] **구분(category) 9종** — 입시·전형/논술/학생부·세특/면접/입결·경쟁률/진로·직업/체험·활동/공모전/기타. 챗봇 라우팅 정확도용으로 '진학'을 세분(2026-06-29 확정).
- [x] **권장 템플릿 3종**(입시·전형/논술/진로·직업) — `npm run templates`로 `public/templates/*.xlsx` 생성, `/datasets/new`에서 다운로드. 평평한 표("한 행=한 단위, 속성은 열") 유도. 강제 X.
- [ ] DB→엑셀 내보내기(왕복 편집), 행별 출처 열 지원, 대용량 분할 저장.
- [~] **RAG 챗봇** — `/chat` + `/api/chat` + `lib/chat/`(retrieve+answer). 2단 검색(봉투/열 키워드로 데이터셋 라우팅 → 매칭 행; 작은 표는 통째, 큰 표만 필터, LLM 無비용) → Claude(**Haiku 4.5**)로 *검색된 행만 근거로* 답변·출처 인용, 없으면 "검증자료 없음" 솔직히. 키 없으면 우아한 폴백. **검색 로직 dev 검증 완료**(라우팅·행선택·무매칭 0건). **남음**: `ANTHROPIC_API_KEY` 설정 후 실답변 검증, 비로그인 비용 게이트(rate limit/auth), 정보 충돌 시 양쪽 표시 튜닝, 교사 수정 루프, (선택)의미검색.

> ⚠️ **보안 메모**: `xlsx`(SheetJS) npm 0.18.5는 알려진 취약점(프로토타입 오염 등) 있음. 파싱이 클라이언트(브라우저)라 위험 표면은 업로더 본인 브라우저로 제한적이나, 상업 배포 전 SheetJS CDN 패치판으로 교체 또는 서버 파싱 격리 검토.

## 미해결 질문

1. ~~Firebase 프로젝트: 공유 vs 분리~~ → **확정: 신규 전용 프로젝트 `jinro-community`** (2026-06-26).
2. 카드 기여 흐름: 누가 어떤 검증을 거쳐 `usedCount`/게시 권한을 얻는가.
3. `external_feed` 자동 수집의 신뢰 출처 범위(기획서 sources와 kakao-daily sources.json 합집합).
4. 배포 도메인/서브패스, I&AI 브랜드 사이트와의 관계.
