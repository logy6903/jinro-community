# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

## 프로젝트 개요

전국 **진로교사를 위한 무료 커뮤니티**. 시기(학사일정)별로 "지금 필요한 활동·수업·정보"를 알아서 띄워주고, 그 위에 선생님들이 자료를 공유·검증하는 층을 얹는다. 운영 주체는 **I&AI 미래역량교육연구소**. 표면 목적은 무료 정보 제공·네트워크 확산, 이면 목적은 브랜드 신뢰 축적과 자연스러운 온램프.

상업 배포 예정 — 코드 품질·보안·문서화 주의. moon2 컨테이너의 **별개 프로젝트**로, 다른 프로젝트(career_navigation, OA, kakao-daily 등)와 스택은 통일하되 코드/데이터/배포는 독립.

**전체 시스템에서의 위치**: 이 페이지는 단독 서비스가 아니라 기존 **kakao-daily(유통/발사 레이어)**의 *공급·축적·큐레이션 백엔드(탄약고)*다.

```
[이 커뮤니티]            [달력 엔진]              [kakao-daily]
콘텐츠 축적·검증   →   이번 주 무엇을 띄울지   →   카톡으로 발사
   (탄약고)               (조준 장치)              (총구)
```

**현재 상태**: MVP 동작 (홈 시기별 추천 + 활동카드 공유 + 달력 엔진 + 연동 피드). **Firestore 연결 완료** — 카드 읽기·`usedCount` 쓰기 모두 Firestore 경유(admin SDK), 미설정 시 코드 시드(`src/lib/content/cards.ts`)로 폴백. **Google 로그인(Firebase Auth) + per-teacher usage_signal 중복방지 연결·검증 완료** — "써봤어요"는 로그인 교사의 uid로 `content_cards/{id}/usage/{uid}`에 기록되어 중복 카운트 방지. 다음: 자료 공유 게시판, 외부집계 피드, 다이제스트(Phase 2).

---

## 확정된 핵심 결정 (대화에서 합의됨 — 코드만 봐서는 알 수 없는 *왜*)

### 1. kakao-daily 연동 = **느슨한 연결** (흡수 X)
- 실측 결과 kakao-daily는 **DB가 없는** 플랫파일+git 구조이고, 독자(중·고 학생·학부모·교사 전반)와 콘텐츠 단위(일일 칼럼)가 본 프로젝트(진로교사 / 활동카드)와 다르다. 흡수하면 둘 다 망가진다.
- 계약: **커뮤니티가 자체 DB를 소유**하고, "이번 주 띄울 카드"를 **읽기 전용 HTTP 피드**(`/api/feed`)로 노출한다. kakao-daily의 `collect.mjs`가 이를 한 source로 당겨가면 된다. **테이블 공유가 아니라 피드 연동.**
- 유일하게 공유할 가치가 있는 것은 kakao-daily의 **외부 정보 집계 스크래퍼**(`feeds/serii/kcue/govcms.mjs`) — 데이터 모델을 합칠 이유가 아니라 *코드를 포팅*할 후보. (Phase 2의 external_feed에서 재사용)

### 2. 빈 게시판 방지 = **시기별 자동 큐레이션이 동력**
- 동력은 "선생님 업로드"가 아니라 달력 엔진. 기여자 0명이어도 첫날부터 쓸 게 있어야 한다.
- 달력 엔진은 `src/lib/calendar/`. 학사일정을 **데이터 테이블**(`academicCalendar.ts`)로 두고, 엔진(`engine.ts`)이 오늘 → 활성 시기 → 노출 태그를 계산한다. **시기를 코드에 하드코딩하지 말 것** — 테이블만 고친다.

### 3. 첫 "퍼나르기 단위" = **시기별 활동카드**
- 모든 콘텐츠는 단톡방에 링크 하나로 던질 수 있는 1조각(`ContentCard`). 비회원 열람 가능, 끝에 I&AI 귀속.
- 카드 face = `ActivityCard`, 상세 = `/card/[id]`, 공유 = `ShareButton`(Web Share API → 클립보드 폴백).

### 4. 중/고 분리 = **처음부터 두 갈래** (필수)
- 서로 다른 학사 달력. `SchoolLevel = "middle" | "high"`가 도메인 전반의 1급 축. 홈은 `?level=`로 토글.
- 중: 자유학기·진로탐색. 고: 학생부·진로선택과목·입시 연계.

### 5. 홍보는 보이지 않게 / 신뢰 신호 ≠ 좋아요
- 광고 배너·"신청하세요" 버튼 금지. 브랜드는 유능함의 증거로만.
- "○명이 실제 수업에 사용함"(`usedCount`, `UsedButton`)이 좋아요보다 위. 현장 검증 신호 우선.
- 양파구조: 핵심 콘텐츠는 로그인·결제 뒤에 숨기지 않는다. 가입은 "다이제스트 더 받기"에만.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend/Backend | Next.js 16 (App Router) + TypeScript(strict) + Tailwind 4 |
| 라우팅 | App Router. `searchParams`/`params`는 **Promise** (await 필수, Next 16) |
| DB | Firebase Firestore — **연결됨**. 서버 admin SDK로 읽기/쓰기 (`src/lib/firebase/admin.ts` → `src/lib/content/repository.ts`) |
| Auth | Firebase Auth **Google 로그인 연결됨**. client SDK `src/lib/firebase/client.ts`(config 없으면 비활성), context `src/lib/auth/AuthProvider.tsx`, 서버 토큰 검증 `getAdminAuth()` |
| Deployment | Vercel (예정) |

> ⚠️ **Next.js 16은 학습 데이터 이후 버전.** 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 먼저 확인할 것 (`AGENTS.md`). 현재 node_modules는 OA 프로젝트 것을 참고해 스캐폴드함 — 본 폴더에 `npm install` 후 docs는 여기서 확인.

---

## 명령어

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:3300)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버 (포트 3300)
npm run lint     # ESLint
```

> 포트 **3300** 고정 (moon2 충돌 방지: career_navigation 20000, maumbaeum 8000, OA 3200, Q 3100).

---

## Firebase 설정

전용 Firebase 프로젝트(`jinro-community`)를 사용. 서버는 **admin SDK**로만 접근하므로 Firestore 보안 규칙은 **잠금(`allow read, write: if false`)** 상태로 둔다 (admin이 규칙 우회). 클라이언트 직접 접근은 Phase 2 Auth 도입 시 path별로 명시 허용.

로컬/배포 자격증명 (둘 중 하나, admin.ts가 순서대로 탐색):
1. **`service-account.json`** — Firebase 콘솔 > 프로젝트 설정 > 서비스 계정 > "새 비공개 키 생성"의 JSON을 프로젝트 루트에 이 이름으로 저장. **`.gitignore`에 등록됨 — 절대 커밋 금지** (전권 마스터 키).
2. **`FIREBASE_ADMIN_*` env** (Vercel/CI용) — `.env.example` 참조. `FIREBASE_SERVICE_ACCOUNT_PATH`로 파일 경로 지정도 가능.

```bash
npm run seed     # src/lib/content/cards.ts 시드를 Firestore content_cards 컬렉션에 업로드 (idempotent)
npm run collect  # RSS 출처(src/lib/feed/sources.json) → Firestore external_feed upsert (kakao-daily 포팅, 정기 실행은 추후 GitHub Action)
npm run templates # 권장 엑셀 템플릿(입시·전형/논술/진로·직업)을 public/templates/*.xlsx 로 생성
```

> 자격증명이 없으면 앱은 시드로 폴백하며 정상 동작. 클라이언트용 `NEXT_PUBLIC_FIREBASE_*` 6개는 Phase 2 Auth 전까지 불필요.

## 디렉토리 구조

```
src/
  app/
    layout.tsx              # 헤더/푸터 + I&AI 귀속
    page.tsx                # 홈 — 시기별 추천 (?level=middle|high)
    card/[id]/page.tsx      # 활동카드 상세 (공개, 공유 단위)
    board/page.tsx          # 자료 공유 게시판 목록 (공개, 중/고 필터)
    board/[id]/page.tsx     # 공유 자료 상세 (공개)
    board/new/page.tsx      # 자료 작성 (로그인 교사만)
    feed/page.tsx           # 정보 모아보기 (external_feed 자동 수집, 공개)
    datasets/page.tsx       # 진학·진로 데이터 목록 (엑셀 업로드, 공개 열람)
    datasets/[id]/page.tsx  # 데이터셋 상세 (봉투 + 표)
    datasets/new/page.tsx   # 엑셀 업로드 (로그인 교사, 브라우저 SheetJS 파싱)
    chat/page.tsx           # 자료 챗봇 UI (근거 기반 Q&A, 공개)
    api/feed/route.ts       # kakao-daily 연동용 읽기 피드
    api/datasets/route.ts   # 데이터셋 작성 POST (토큰 검증, 봉투+행 저장)
    api/chat/route.ts       # RAG 챗봇 POST (검색→Claude, ANTHROPIC_API_KEY 필요)
    api/materials/route.ts  # 자료 작성 POST (토큰 검증)
    api/cards/[id]/use/route.ts  # "써봤어요" (토큰 검증, per-teacher 중복방지)
  components/
    SchoolLevelToggle.tsx   # 중/고 토글
    ActivityCard.tsx        # 카드 face
    ShareButton.tsx         # 퍼나르기 (client)
    UsedButton.tsx          # "수업에 써봤어요" (client, MVP 낙관적)
  lib/
    domain/types.ts         # ContentCard, AcademicPeriod, SchoolLevel ...
    domain/labels.ts        # 한국어 라벨
    calendar/academicCalendar.ts  # 학사일정 데이터 테이블
    calendar/engine.ts      # 오늘 → 활성 시기 → 태그 (순수 함수)
    content/cards.ts        # 시드 활동카드 (수동 태깅)
    content/query.ts        # getCardsForNow (홈·피드 공통 진입점)
    content/repository.ts   # 카드 Firestore 읽기 + recordUsageForUser (시드 폴백)
    materials/repository.ts # shared_materials 생성/목록/조회 (게시판)
    datasets/repository.ts  # datasets(봉투+rowsJson) 생성/목록/조회 + 엑셀 검증 상한
    chat/retrieve.ts        # RAG 검색 (봉투/열 키워드 2단 라우팅, 임베딩 無)
    chat/answer.ts          # Claude(Haiku) 근거 답변·출처 인용 (키 없으면 폴백)
    firebase/admin.ts       # 서버 admin SDK (Firestore + Auth, service-account.json)
    firebase/client.ts      # 브라우저 SDK (NEXT_PUBLIC, 없으면 비활성)
    auth/AuthProvider.tsx   # 클라이언트 Auth 컨텍스트 (Google 로그인)
```

---

## 코딩 컨벤션

- **언어**: UI 텍스트 한국어, 코드 식별자/주석 영어.
- **파일명**: 컴포넌트 PascalCase, 유틸/훅 camelCase, 상수 UPPER_SNAKE_CASE.
- **달력/콘텐츠는 데이터로**: 시기·카드는 enum이 아니라 테이블(`academicCalendar.ts`, `cards.ts`)에 등록되는 데이터. 코어 로직은 건드리지 않는다.
- **비밀 노출 금지**: Firebase 공개 키 외 모든 시크릿은 API Route를 통해서만.

## 참조 문서

- `PROJECT_PLAN.md` — 로드맵, 데이터 모델, 연동 계약, 미해결 질문
- `../CLAUDE.md` — moon2 컨테이너 안내 (본 프로젝트와는 별개)
