import { formatDate } from './utils'

function buildFrontMatter(note) {
  const dateStr = formatDate(new Date(note.updatedAt || Date.now()))
  const title = (note.title || '제목 없음').replace(/"/g, '\\"')
  const category = note.category ? `"${note.category.replace(/"/g, '\\"')}"` : ''
  const tags = (note.tags || []).map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ')
  return ['---', `title: "${title}"`, `date: ${dateStr} 00:00:00 +0900`, `categories: [${category}]`, `tags: [${tags}]`, '---', '', ''].join(
    '\n',
  )
}


// 노트 <-> 마크다운 파일 직렬화. front matter 값은 JSON 리터럴(YAML의 부분집합)로
// 기록해 라인 단위 JSON.parse만으로 무손실 왕복이 가능하고 Obsidian에서도 읽힌다.
const NOTE_META_FIELDS = ['id', 'problemId', 'title', 'category', 'tags', 'folderId', 'createdAt', 'updatedAt', 'published', 'publishedPath']

function noteToMarkdown(note) {
  const lines = ['---']
  for (const key of NOTE_META_FIELDS) lines.push(`${key}: ${JSON.stringify(note[key] ?? null)}`)
  lines.push('---', '')
  return lines.join('\n') + (note.content || '')
}

function markdownToNote(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return null
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(': ')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (!NOTE_META_FIELDS.includes(key)) continue
    try {
      meta[key] = JSON.parse(line.slice(idx + 2))
    } catch {
      // 손상된 라인은 건너뛰고 나머지 메타데이터는 살린다
    }
  }
  if (!meta.id) return null
  return {
    problemId: null,
    title: '',
    category: '',
    tags: [],
    folderId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    published: false,
    publishedPath: null,
    ...meta,
    content: text.slice(m[0].length),
  }
}

// 스니펫 <-> 마크다운 직렬화 — 노트와 동일한 front matter(JSON 리터럴) 패턴
const SNIPPET_META_FIELDS = ['id', 'name', 'title', 'createdAt', 'updatedAt']

function snippetToMarkdown(snippet) {
  const lines = ['---']
  for (const key of SNIPPET_META_FIELDS) lines.push(`${key}: ${JSON.stringify(snippet[key] ?? null)}`)
  lines.push('---', '')
  return lines.join('\n') + (snippet.content || '')
}

function markdownToSnippet(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return null
  const meta = {}
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(': ')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    if (!SNIPPET_META_FIELDS.includes(key)) continue
    try {
      meta[key] = JSON.parse(line.slice(idx + 2))
    } catch {
      // 손상된 라인은 건너뛰고 나머지 메타데이터는 살린다
    }
  }
  if (!meta.id) return null
  return {
    name: '',
    title: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...meta,
    content: text.slice(m[0].length),
  }
}

export { buildFrontMatter, NOTE_META_FIELDS, noteToMarkdown, markdownToNote, SNIPPET_META_FIELDS, snippetToMarkdown, markdownToSnippet }
