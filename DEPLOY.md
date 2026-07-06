# 배포 방법 (jinro-community)

**배포 = GitHub `master`에 push → Vercel 자동 배포.**
레포 `logy6903/jinro-community` · 라이브 <https://jinro-community.vercel.app>

> 이 문서는 어느 세션(대화창)에서든 이 프로젝트를 배포할 때의 기준입니다.

## ⚠️ 반드시 지킬 것

- **`jinro-community/` 폴더 안에서만** git 하기.
  **moon2 컨테이너 루트에서 `git push` 금지** — 다른 프로젝트 레포로 잘못 갑니다.
- **`git add -A` 금지.** 이 폴더는 여러 세션이 동시에 공유합니다.
  `-A`로 쓸어 담으면 **다른 세션의 미커밋 작업까지 딸려갑니다.**
  → 항상 `git status`로 확인하고 **내가 바꾼 파일만 경로로 명시**해서 add.

## 명령 (WSL 터미널 권장)

```bash
cd ~/cursor_projects/moon2/jinro-community
git status                          # 내 파일만 골라내기 위해 먼저 확인
git add 경로/내파일1 경로/내파일2    # -A 쓰지 말 것
git commit -m "설명"
git push origin master              # → Vercel이 자동 배포
```

- Windows 셸에서 WSL 경로로 git 할 땐 줄바꿈 오염 방지로
  `git -c core.autocrlf=false add/commit` 사용.
- 빌드(`npm run build`)는 리눅스 swc 바이너리라 Windows에서 실패 →
  **빌드/배포는 WSL 기준.**

## 배포 후 확인

1. **Vercel 대시보드에서 빌드 성공** 여부 확인 (실패해도 직전 배포는 유지됨).
2. **Firebase 콘솔 → Authentication → 승인된 도메인**에
   `jinro-community.vercel.app` 존재 확인 — 없으면 로그인 자체가 안 됩니다.
   *(현재 추가돼 있음)*
3. **환경변수**(Firebase Admin 3개 + `ANTHROPIC_API_KEY` 포함 11개)는
   최초 1회 설정 완료 — 평소엔 손댈 필요 없음.
   - 로컬은 루트 `service-account.json`(gitignore)로 admin 인증하지만
     Vercel엔 파일을 못 올리므로 그 JSON의 값을
     `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` /
     `FIREBASE_ADMIN_PRIVATE_KEY`(`\n` 이스케이프) 3개 env로 이관해 둠.

## 수동 배포 (보통 불필요)

GitHub가 연결돼 있어 push만으로 배포됩니다. 굳이 수동으로 하려면
같은 폴더에서 `vercel --prod`.

## 즉시 스톱갭 (유료 AI 잠깐 끄기)

Vercel 환경변수에서 `ANTHROPIC_API_KEY` 제거 → 저장 → 재배포하면
유료 AI 엔드포인트가 즉시 무력화됩니다(제출·저장 등 나머지는 정상).
URL을 아는 사람이 없으면 생략 가능.
