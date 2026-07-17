import { formatDate, formatDateTime } from './utils'

function buildTemplate() {
  const lines = []
  lines.push(
    '## 접근 방식 (핵심 알고리즘)',
    '',
    '',
    '## 시간/공간 복잡도 분석',
    '',
    '<!-- 예: 시간복잡도 $O(N \\log N)$, 공간복잡도 $O(N)$ -->',
    '',
    '',
    '## WA(맞왜틀) 원인 및 디버깅 기록',
    '',
    '',
    '## 정답 코드',
    '',
    '```cpp',
    '#include <bits/stdc++.h>',
    'using namespace std;',
    '',
    'int main() {',
    '    ios_base::sync_with_stdio(false);',
    '    cin.tie(NULL);',
    '',
    '',
    '    return 0;',
    '}',
    '```',
    '',
  )
  return lines.join('\n')
}

// 스니펫 시드: LS 키가 처음 생성될 때 1회만 주입 (사용자가 지우면 재시드되지 않음).
// id를 고정해 여러 기기에서 각자 시드해도 동기화 시 같은 파일로 수렴한다.
const DEFAULT_SNIPPETS = [
  {
    id: 'default-ps-template',
    name: 'PS 풀이 템플릿',
    content: buildTemplate(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

// {{date}}/{{time}}/{{datetime}} 치환 — 스니펫 본문/제목 템플릿 공용
function renderSnippetVars(text) {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return (text || '')
    .replaceAll('{{date}}', formatDate(now))
    .replaceAll('{{time}}', time)
    .replaceAll('{{datetime}}', formatDateTime(now.getTime()))
}

// 본문 치환: 변수 + {{title}}, {{cursor}} 위치(제거됨)를 반환
function renderSnippet(content, { title } = {}) {
  let text = renderSnippetVars(content).replaceAll('{{title}}', title || '')
  const cursorIdx = text.indexOf('{{cursor}}')
  text = text.replaceAll('{{cursor}}', '')
  return { text, cursorOffset: cursorIdx === -1 ? text.length : cursorIdx }
}

export { buildTemplate, DEFAULT_SNIPPETS, renderSnippetVars, renderSnippet }
