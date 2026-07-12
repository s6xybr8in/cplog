# CP-Log

Competitive Programming 개인 노트 & 블로그 퍼블리셔. 백엔드 없이 브라우저에서만 동작하는 Vite + React SPA입니다.

- **To Solve 보드** — 링크/텍스트 붙여넣기로 즉시 문제 등록(플랫폼·이름 자동 파싱), 고밀도 리스트 + 칸반 토글, 복습 큐
- **에디터** — CodeMirror 6, KaTeX 수식, 코드 하이라이팅, 스니펫, 옵시디언식 `[[위키링크]]` + 백링크
- **저지 연동** — Codeforces/AtCoder 핸들만 넣으면 AC 자동 반영, CF 레이팅 자동 채우기
- **GitHub 동기화** — 노트/문제를 개인 private 리포(`cplog-data`)에 마크다운으로 동기화 (Obsidian 호환)
- **원클릭 발행** — Front Matter를 붙여 GitHub Pages 블로그(`_posts/`)로 커밋
- **통계** — 활동 히트맵, 태그별 해결 분포

모든 데이터(PAT 포함)는 브라우저 localStorage와 본인 GitHub 리포에만 저장됩니다.

## 개발

```bash
npm install
npm run dev
```

`main` 브랜치에 push하면 GitHub Actions가 자동으로 GitHub Pages에 배포합니다.
