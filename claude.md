# 프로젝트 명: CP-Log (Competitive Programming 개인 노시디언 & 블로그 퍼블리셔)

## 📌 역할 설정
너는 프론트엔드 개발 및 생산성 도구 설계의 전문가야. React, Tailwind CSS, Lucide-react 아이콘을 활용하여 단일 파일로 동작하는 인터랙티브 웹 애플리케이션(Artifacts)을 만들어줘. UI는 깔끔하고 직관적인 화이트(Light) 테마 기반의 모던한 디자인으로 구성해 줘.

## 🚀 핵심 목표
알고리즘 문제 해결(CP/PS) 학습을 위한 개인용 노션(Notion) 스타일의 에디터이자, 작성한 오답 노트와 풀이를 GitHub Pages(기술 블로그)로 원클릭 자동 푸시하는 통합 웹앱을 구축한다. (주요 타겟 플랫폼: Codeforces, AtCoder, USACO, KOI)

## 🛠️ 주요 요구사항 및 기능 상세

### 1. To Solve (풀 문제 관리) 보드
- **레이아웃**: 노션의 칸반(Kanban) 보드 또는 데이터 그릴드 스타일.
- **데이터 필드**: 문제 이름/링크, 플랫폼(Codeforces, AtCoder 등), 난이도, 태그(수론, 그리디, DP 등), 상태(To Do, In Progress, Done).
- **인터랙션**: 상태를 'Done'으로 변경 시, 해당 문제 데이터를 기반으로 한 '오답 노트 작성(Editor)' 탭으로 자동 전환되며 기본 템플릿이 로드됨.

### 2. Markdown & PS 특화 에디터 (Dual-Pane)
- **레이아웃**: 좌측은 마크다운 작성 에디터, 우측은 실시간 프리뷰 렌더링.
- **PS 특화 렌더링**:
  - 수학 수식 완벽 지원 (LaTeX 문법, `$O(N \log N)$` 등 렌더링).
  - C++ 및 Python 코드 블록 구문 강조(Syntax Highlighting) 지원.
- **템플릿 자동화**: 에디터 상단에 [PS 풀이 템플릿 로드] 버튼을 두어 아래 양식을 삽입.
  - 접근 방식 (핵심 알고리즘)
  - 시간/공간 복잡도 분석
  - WA(맞왜틀) 원인 및 디버깅 기록
  - 정답 C++ 코드

### 3. GitHub Blog 원클릭 퍼블리셔 (핵심 기능)
- **설정 모달 (Settings)**:
  - GitHub Username, Repository Name, Branch Name(기본 `main`), Personal Access Token (PAT)을 입력받음. (입력값은 브라우저 LocalStorage에 안전하게 저장)
- **🚀 Publish 버튼**: 에디터 우측 상단에 배치.
- **발행 로직**:
  - 버튼 클릭 시 작성된 마크다운 상단에 Jekyll/Hugo 블로그용 Front Matter(title, date, categories, tags)를 자동 부착.
  - GitHub REST API (`PUT /repos/{owner}/{repo}/contents/_posts/{YYYY-MM-DD-title}.md`)를 호출하여 리포지토리에 파일 커밋.
  - 성공/실패 여부를 토스트(Toast) 알림으로 UI에 피드백.

### 4. 로컬 데이터 저장소 (Local Storage)
- 브라우저를 새로고침하거나 껐다 켜도 작성 중이던 글, To Solve 리스트, GitHub 설정값이 날아가지 않도록 모든 State를 `localStorage`와 동기화(Sync).

## 💻 출력 형식 제한
- 모든 컴포넌트, 상태 관리 로직, API 호출 로직을 포함한 **단일 React 컴포넌트 코드**로 출력해 줘.
- 백엔드 서버 없이 브라우저 상에서 완벽히 동작해야 하므로 API 호출은 `fetch`를 이용한 클라이언트 사이드 호출로 구현해 줘.

---

# 📈 프로젝트 진행 상황 (2026-07-12 기준)

## 구현 형태 (원문 스펙에서 확정된 해석)
- claude.ai Artifact 스니펫이 아니라 **실행 가능한 Vite + React 19 프로젝트**로 구현 (사용자 선택). `npm install && npm run dev`로 구동.
- 모든 앱 로직은 스펙의 "단일 컴포넌트" 취지대로 `src/App.jsx` 한 파일에 유지 (서브컴포넌트/훅/헬퍼 포함).
- 스택: Tailwind CSS v4(`@tailwindcss/vite`, CSS-first `@theme` 토큰), lucide-react, react-markdown + remark-gfm/math + rehype-katex/highlight, CodeMirror 6(`codemirror` + lang-markdown + language-data), @fontsource (Manrope / IBM Plex Mono / Source Serif 4). devDep: playwright(E2E 검증용 — extraneous로 두면 npm install 때 prune되므로 반드시 devDependencies 유지).

## 🔄 원문 스펙에서 변경된 사항 (사용자 결정이 원문에 우선)
1. **테마**: 원문은 "화이트(Light) 테마 기반"이지만, 이후 요청으로 **다크 테마가 기본**, 라이트는 사이드바 토글로 전환 (`:root[data-theme]` + CSS 변수 토큰, `cplog_theme` localStorage).
2. **에디터 레이아웃**: 원문의 상시 듀얼페인(좌 에디터/우 프리뷰) 대신 **Obsidian식 편집↔미리보기 토글** (전체 폭 단일 페인). 사이드바도 통합형(노트 목록 포함) + 접기 가능한 구조로 개편.
3. **[PS 풀이 템플릿 로드] 버튼**: 주석 처리됨 (사용자: "안 쓸 듯"). 코드에 `{/* */}`로 남아 있음. 단, 문제를 Done으로 옮길 때 템플릿+문제 정보가 자동 삽입되는 `buildTemplate()` 흐름은 살아 있음. → 다음 작업(스니펫)에서 이 버튼은 완전 삭제 예정 (스니펫이 대체).
4. **To Solve 기본 뷰 = 리스트(표), 칸반은 토글 뒤로** (2026-07-12, 사용자 UX 피드백): 칸반의 낮은 밀도·단건 입력 강요·빈 컬럼 공간 낭비 지적. 사용자 실제 기록 습관은 세션(셋) 단위 데일리 마크다운(예: 260709.md — "## A" 헤딩별 한두 줄 + "# Upsolving" 빈 헤딩 = 투두). UX 방향 논의에서 A(세트 행 모델)·B(인박스+리스트)·C(노트 파싱) 중 **B 선택** — 붙여넣기 캡처 바 + 고밀도 표, 셋 개념은 문제 이름에 포함("BCD4 E"). 칸반은 삭제하지 않고 헤더 토글로 유지.

## ✅ 완료된 기능
1. **To Solve 칸반 보드** — 3컬럼, 네이티브 HTML5 DnD(데스크톱 전용 트레이드오프), 문제 추가/수정/삭제 모달, 플랫폼 배지 + Codeforces 티어 색상 난이도 칩 + 태그 칩. Done 전환 시 오답 노트 자동 생성/열기.
2. **마크다운 에디터** — KaTeX 수식 + C++/Python 코드 하이라이팅 프리뷰, Tab 들여쓰기 지원 textarea (→ CodeMirror로 교체 예정).
3. **GitHub 블로그 원클릭 퍼블리셔** — Front Matter 자동 부착, `PUT /repos/{o}/{r}/contents/_posts/...`, sha 조회 후 커밋 + 409 재시도, 토스트 피드백.
4. **localStorage 영속화** — 문제/노트/설정/UI 상태/테마 전부 (`cplog_*` 키, 300ms 디바운스 훅 `useLocalStorageState`).
5. **GitHub 데이터 리포 동기화** (`useGithubSync`) — 별도 private 리포(기본 `cplog-data`)에 `problems.json` + `notes/<id>.md` + `snippets/<id>.md`(front matter=JSON 리터럴, Obsidian 호환) 자동 동기화. 시작 시 트리 API 1회 Pull, 편집 4초 디바운스 Push, dirty/삭제 큐 localStorage 보존, 충돌 시 updatedAt 비교. 사이드바 동기화 인디케이터, 설정 모달에 데이터 리포 섹션 + 원클릭 private 리포 생성.
6. **CodeMirror 6 에디터** (2026-07-12 완료) — textarea SourcePane을 CM6 직접 통합으로 교체(래퍼 라이브러리 없음). `codemirror`/`@codemirror/lang-markdown`/`@codemirror/language-data` + granular 임포트(view/state/commands/search/language/@lezer/highlight). 확장: lineNumbers, highlightActiveLine, history, search(Ctrl+F 패널), lineWrapping, markdown(codeLanguages lazy load — cpp/python 등), indentWithTab. **테마/하이라이트 값은 전부 CSS 변수(`--color-*`, `--code-*`, `--font-mono`)** — data-theme 전환 시 재생성 없이 자동 추종. 동기화 패턴: updateListener로 onChange 전파, 원격 반영 dispatch에는 `Transaction.remote` 주석을 달아 루프/updatedAt 오염 방지, 노트 전환 시 `setState`로 문서+undo 히스토리 리셋. 스니펫 삽입은 `view.dispatch({changes, selection})`. E2E 19건 통과.
7. **스니펫 시스템** (2026-07-12 완료) — `cplog_snippets` LS + `snippets/<id>.md` 동기화. `{{date}}/{{time}}/{{datetime}}/{{title}}/{{cursor}}` 변수 치환(`renderSnippet`), 에디터 메타바 드롭다운(검색+커서 위치 삽입, 미리보기 모드에선 비활성), SnippetsModal(생성/편집/삭제/.md 가져오기·내보내기 — 가져오기는 front matter 있으면 id 기준 upsert, 없으면 파일명=이름). 시드: 고정 id `default-ps-template`(기기 간 중복 방지), 키 최초 생성 시 1회만. 외부에서 front matter 없이 만든 원격 .md는 pull 시 파일명=이름·새 id로 채택 후 표준 경로로 정규화 커밋 + 원본 삭제. 주석 처리돼 있던 "PS 템플릿 로드" 버튼은 완전 삭제(스니펫이 대체). E2E 22건 통과.
8. **Ctrl+K 퀵 스위처 + 전역 단축키** (2026-07-12 완료) — `QuickSwitcher` 모달: 검색 인풋 + 노트/문제/명령 3섹션(노트·문제는 섹션당 8개 제한 `QS_SECTION_LIMIT`, 검색으로 좁히는 전제), ↑↓ 순환/Enter/Esc + 마우스(onMouseMove로 활성화 — 스크롤 시 hover 점프 방지), 활성 항목 scrollIntoView. 노트 선택→에디터+활성화, 문제 선택→보드+수정 모달, 명령 7종(새 노트/편집↔미리보기/지금 동기화/테마 전환/설정/보드·에디터 이동, 단축키 힌트 표시). 전역 단축키는 window **capture-phase** keydown 리스너 1개(App, `shortcutRef`로 최신 상태 참조): Ctrl+K(스위처 토글), Ctrl+E(편집↔미리보기 — 보드에 있으면 에디터로 진입하며 토글), Ctrl+S(수동 동기화, 미설정이면 설정 모달 — preventDefault는 모달 열림 여부와 무관하게 항상 해서 브라우저 저장 다이얼로그 차단), Ctrl+Alt+N(새 노트). 키 매칭은 `e.code` 기준(한글 IME에서도 안전), metaKey도 허용. 다른 모달 열림 시 단축키 무시. Ctrl+F(CM 검색 패널)는 건드리지 않음 — E2E로 무간섭 확인. E2E 21건 통과.
9. **복습 큐** (2026-07-12 완료) — Problem에 `reviewAt: number|null` 추가(problems.json 통째 직렬화라 동기화 자동 포함, 새 문제 기본값 null). Done 전환 시(드래그 `changeProblemStatus`·모달 `upsertProblem` 공통) `ReviewModal`: "3일 뒤/1주 뒤/1달 뒤/안 함" → `applyReviewChoice(days)`가 reviewAt 설정 후 오답 노트 열기 — **모달을 X/배경으로 닫아도 "안 함" 취급으로 노트는 열림**(플로우 비차단). 보드 상단 `ReviewStrip`: reviewAt 있는 문제를 기한순 칩으로(상태 무관), 기한 도래(now≥reviewAt)는 warning 강조 + "오늘/N일 지남" vs "D-N" 라벨, 칩 액션 = 다시 풀기(status→in_progress+reviewAt 해제 — 재Done 시 재선택 루프)·복습 완료(reviewAt만 해제). 사이드바 "풀 문제" NavItem에 기한 도래 개수 배지(접힘 시 점 표시). 모든 변경 `markDirty('problems.json')`. ReviewModal도 전역 단축키의 anyModalOpen에 포함. E2E 22건 통과(드래그 경로는 dispatchEvent로 DnD 시뮬레이션 — `page.dragAndDrop` 대신 dragstart/dragover/drop 수동 디스패치가 네이티브 HTML5 DnD에 동작).

10. **문제 캡처 바(QuickAdd) + 고밀도 리스트 뷰** (2026-07-12 완료) — `parseProblemUrl`(CF/AtCoder/BOJ/USACO URL 패턴 → 플랫폼+이름 자동, 네트워크 없음) + `parseProblemLine`("이름 URL" 혼합·URL 단독·텍스트 단독, 불릿 제거). `QuickAddBar`: URL 단독 붙여넣기 = 즉시 등록, 여러 줄 붙여넣기 = 줄 단위 일괄 등록, 텍스트는 Enter — 등록은 전부 To Do + `markDirty('problems.json')` + 개수 토스트. `ProblemTable`: 한 줄 = 한 문제(상태 셀렉트/문제+링크/플랫폼/난이도/태그/hover 액션), 정렬 in_progress→todo→done(그룹 내 최신순), done 행 흐림. 상태 셀렉트는 `changeProblemStatus` 공통 경로라 Done 시 복습 모달·노트 생성이 칸반 드래그와 동일. `uiState.boardMode`('list' 기본 | 'kanban') 헤더 토글, 기존 칸반은 `KanbanColumns`로 분리돼 `ProblemBoard` 래퍼(헤더+캡처바+복습스트립+뷰) 아래 유지. E2E 23건 통과 (paste는 합성 ClipboardEvent 디스패치가 아니라 **clipboard 권한 + 실제 Ctrl+V**로 테스트해야 동작).

11. **옵시디언식 `[[링크]]` 자동완성** (2026-07-12 완료, 계획: ~/.claude/plans/idempotent-jingling-thacker.md) — 에디터에서 `[[` 타이핑 또는 `Ctrl+Shift+L`(CM 키맵, `[[` 삽입+`startCompletion`)로 노트/문제 인라인 자동완성. `@codemirror/autocomplete`(codemirror 메타의 전이 의존성, 새 npm 의존성 없음) `override` 소스 — 노트는 `[[제목]]`(apply 문자열), 문제는 여는 `[[`까지 치환해 `[이름](url)`(apply 함수). 동적 데이터는 SourcePane의 `linkDataRef`(렌더마다 갱신, onChangeRef 패턴). 프리뷰: 직접 작성한 `remarkWikiLinks` 플러그인(text 노드 분할→`#wiki:` link 노드, code는 value 노드라 자연 제외) + `components.a` 오버라이드 — 위키링크 클릭 시 제목 일치 노트 열기/**없으면 자동 생성**(옵시디언 관례), 존재 여부로 `cp-wikilink`/`cp-wikilink-missing`(index.css) 구분, 일반 링크는 `target=_blank`. 발행 시 `[[제목]]`→제목 텍스트 변환(블로그 raw 노출 방지). CM 툴팁 스타일도 CSS 변수로 cmTheme에 추가. E2E 19건 통과.

12. **저지 연동** (2026-07-13 완료) — 설정 "저지 연동" 섹션에 `cfHandle`/`atcoderHandle`(LS만, 공개 API라 토큰 불필요). 시작 시(핸들 조합당 1회) + Ctrl+K "저지 동기화" 명령으로 `syncJudges`: CF `user.status`(count=3000)·kenkoooo `v3/user/submissions`(500건 페이지네이션, 상한 10회)에서 AC 수집 → `judgeKeyFromUrl`(cf:1850A / ac:abc300_a — URL에서 파생, 스키마 변경 없음)로 보드 문제 매칭 → **조용히 Done 처리**(복습 모달·노트 생성 없음, 일괄 반영이라 모달 연쇄 방지) + `solvedAt`=최초 AC 시각. 난이도 빈 CF 문제는 `problemset.problems`(세션당 1회 캐시, 핸들 불필요)로 레이팅 자동 채움 — tried Set으로 재시도 스팸 방지. **CORS 실측**: codeforces.com API·kenkoooo submissions 허용 / **solved.ac(BOJ)·kenkoooo problems.json 차단** → BOJ 자동화·AtCoder 난이도는 스코프 제외. 수동 Done 전환(`changeProblemStatus`/`upsertProblem`)도 `solvedAt` 기록.
13. **세션 노트 원클릭** (2026-07-13 완료) — Ctrl+K "오늘 세션 노트 만들기" → SessionNoteModal(셋 이름 선택 입력 + 문제 개수 1~12) → 제목 `YYMMDD [셋이름]`(사용자 파일 관례, 예: 260709), 본문 `## A`~ + `# Upsolving`, 카테고리=셋 이름.
14. **백링크 + 전문 검색** (2026-07-13 완료) — `BacklinksBar`: 에디터 하단에 현재 노트를 `[[제목]]`으로 언급한 노트 칩(정확 문자열 매치), 클릭 시 이동. Ctrl+K 노트 검색이 제목/태그 불일치 시 **본문까지** 검색, 매치 시 주변 문맥 스니펫을 서브텍스트로 표시.
15. **통계 뷰** (2026-07-13 완료) — 사이드바 "통계"(activeView 'stats') + Ctrl+K 명령. 스탯 타일 4종, GitHub식 26주 활동 히트맵(일요일 시작 열, 활동 = `solvedAt` 문제 + `createdAt` 노트, accent 명도 램프 `HEAT_LEVELS` 5단계 + 셀 title 툴팁 + 범례), 태그별 해결 분포 top8 단일색 가로 막대(텍스트는 잉크 토큰). dataviz 스킬 지침 적용(단일색 sequential, 다중 시리즈 카테고리 팔레트 없음). 다크/라이트 스크린샷 육안 검증.

## ⚠️ 반드시 지켜야 할 기술 제약 (검증으로 확인된 사실)
- **`X-GitHub-Api-Version` 헤더를 브라우저 fetch에 절대 추가하지 말 것** — GitHub CORS preflight 허용 목록에 없어 요청 자체가 실패함 (github/docs#24706). `Authorization: Bearer` + `Accept: application/vnd.github+json`만 사용 (`ghFetch` 헬퍼 경유).
- UTF-8→base64는 `TextEncoder`/`TextDecoder` 기반 (`toBase64`/`fromBase64`). `unescape()` 금지.
- 동기화 엔진의 path→sha 맵(`filesRef`)은 **in-memory 단일 진실 공급원** — pull/push가 직접 갱신하고 localStorage로 미러링만 함. React 상태 왕복에 의존하면 pull 직후 push가 stale 맵을 읽는 버그 재발 (실제로 한 번 발생해 수정함).
- PAT·GitHub 설정·테마는 절대 데이터 리포에 푸시하지 않음.
- 검증 방법: Playwright + `page.route('https://api.github.com/**')` 목킹으로 E2E (트리/컨텐츠 GET, PUT 바디의 sha·front matter 검증). 임시 검증 스크립트는 검증 후 삭제.
- **저지 API CORS (2026-07-13 브라우저 실측)**: codeforces.com/api(user.status, problemset.problems)와 kenkoooo.com/atcoder/atcoder-api/v3(user/submissions)는 브라우저 fetch 허용. **solved.ac API와 kenkoooo problems.json(S3 정적)은 차단** — BOJ 티어 조회·AtCoder 난이도는 프록시 없이 불가하니 재시도하지 말 것.
- **vite.config.js의 `server.watch.ignored: ['**/.omc/**']`를 제거하지 말 것** — OMC(에이전트 툴링) 훅이 `.omc/state/*.json`을 수 초 간격으로 갱신해 dev 서버가 풀 리로드를 반복, E2E가 랜덤한 지점에서 실패하는 가짜 플레이크를 만든다 (Ctrl+K E2E에서 실제 발생해 수정).

## 🚀 배포 (2026-07-13 완료)
- **라이브**: https://s6xybr8in.github.io/cplog/ · **리포**: https://github.com/s6xybr8in/cplog (공개)
- `main` push마다 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드·배포. Pages는 `build_type=workflow`로 활성화됨.
- **base 경로는 CI에서만** `DEPLOY_BASE=/cplog/` env로 주입 (vite.config.js) — 로컬 dev/E2E는 `/` 그대로. 리포 이름을 바꾸면 워크플로의 DEPLOY_BASE도 함께 수정할 것.
- 공개 리포이므로 **개인 연습 기록(260709.md, contest1.md)과 `.omc/`는 .gitignore로 제외** — 커밋 전 `git status`로 개인 파일 유입 확인 습관.
- gh CLI 설치됨(winget, `C:\Program Files\GitHub CLI\gh.exe`), `s6xybr8in` 계정으로 인증. 기존 셸 PATH에는 없을 수 있어 전체 경로 호출이 안전.
- 주의: Git Bash에서 `DEPLOY_BASE=/cplog/`처럼 `/`로 시작하는 env 값은 MSYS가 Windows 경로로 변환해버림 — 로컬에서 base 검증할 땐 PowerShell 사용.

## 🚧 다음 작업
없음 — 승인된 계획(~/.claude/plans/snug-snacking-pike.md)의 4개 스코프(스니펫·CodeMirror·Ctrl+K·복습 큐) 전부 완료 (완료된 기능 #6~#9).

향후 E2E 작성 시 참고: GitHub 동기화를 검증할 땐 **목킹은 스테이트풀로**(PUT/DELETE가 트리 응답에 반영) — 정적 트리 목킹은 새로고침 후 pull이 push된 파일을 "원격 삭제됨"으로 오판해 로컬 데이터를 지우는 가짜 실패를 만든다 (스니펫 E2E에서 실제 발생). 시드는 `addInitScript`가 reload마다 재실행되므로 마커 키로 1회만 주입할 것.