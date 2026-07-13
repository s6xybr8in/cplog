import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  LayoutGrid,
  FileText,
  Settings,
  Plus,
  X,
  Trash2,
  ExternalLink,
  Rocket,
  Github,
  Pencil,
  Eye,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Check,
  Sun,
  Moon,
  ChevronsLeft,
  ChevronsRight,
  Cloud,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
  Braces,
  Download,
  Upload,
  Search,
  CalendarClock,
  RotateCcw,
  Zap,
  Trophy,
  CalendarPlus,
  Link2,
  ChartColumn,
  Folder,
  FolderPlus,
  ChevronRight,
} from 'lucide-react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import { EditorView as CMEditorView, lineNumbers, highlightActiveLine, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState, Transaction } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LS_KEYS = {
  PROBLEMS: 'cplog_problems',
  NOTES: 'cplog_notes',
  FOLDERS: 'cplog_folders',
  SNIPPETS: 'cplog_snippets',
  GITHUB: 'cplog_github_settings',
  UI: 'cplog_ui_state',
  THEME: 'cplog_theme',
  SYNC: 'cplog_sync_state',
}

const PLATFORMS = ['Codeforces', 'AtCoder', 'BOJ', 'USACO', 'KOI', 'Other']

const PLATFORM_BADGE = {
  Codeforces: 'bg-tier-blue/10 text-tier-blue',
  AtCoder: 'bg-tier-cyan/10 text-tier-cyan',
  BOJ: 'bg-tier-purple/10 text-tier-purple',
  USACO: 'bg-tier-green/10 text-tier-green',
  KOI: 'bg-tier-orange/10 text-tier-orange',
  Other: 'bg-surface-alt text-ink-muted',
}

const DIFFICULTY_TIER_BADGE = {
  gray: 'bg-tier-gray/10 text-tier-gray',
  green: 'bg-tier-green/10 text-tier-green',
  cyan: 'bg-tier-cyan/10 text-tier-cyan',
  blue: 'bg-tier-blue/10 text-tier-blue',
  purple: 'bg-tier-purple/10 text-tier-purple',
  orange: 'bg-tier-orange/10 text-tier-orange',
  red: 'bg-tier-red/10 text-tier-red',
}

// 상태는 To Do / Done 2가지만 (In Progress는 2026-07-13 제거 — 사용자 요청)
const COLUMNS = [
  { key: 'todo', label: 'To Do', hint: '풀어야 할 문제' },
  { key: 'done', label: 'Done', hint: '해결 완료 · 노트 작성' },
]

// 리스트 뷰 정렬 순서 — 미해결이 위, 끝난 문제가 맨 아래
const STATUS_ORDER = { todo: 0, done: 1 }

const TAG_SUGGESTIONS = ['DP', '그리디', '그래프', '이분탐색', '수론', 'BFS/DFS', '자료구조', '문자열', '구현']

// 폴더 색상 프리셋 — 다크/라이트 양쪽에서 읽히는 500 계열 고정 hue
const FOLDER_COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  pink: '#ec4899',
}
const FOLDER_EMOJI_PRESETS = ['📁', '🏆', '📚', '🔥', '💡', '🎯', '⚡', '📝']

const DAY_MS = 86400000

const REVIEW_OPTIONS = [
  { key: '3d', label: '3일 뒤', days: 3 },
  { key: '1w', label: '1주 뒤', days: 7 },
  { key: '1m', label: '1달 뒤', days: 30 },
  { key: 'none', label: '안 함', days: null },
]

const DEFAULT_GITHUB_SETTINGS = {
  username: '',
  repo: '',
  branch: 'main',
  pat: '',
  dataRepo: 'cplog-data',
  dataBranch: 'main',
  autoSync: true,
  cfHandle: '',
  atcoderHandle: '',
}

const TOAST_STYLE = {
  success: { icon: CheckCircle2, cls: 'border-success/30 bg-success-soft text-success' },
  error: { icon: XCircle, cls: 'border-danger/30 bg-danger-soft text-danger' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateTime(ts) {
  const d = new Date(ts)
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function slugify(title) {
  const cleaned = (title || 'untitled')
    .trim()
    .replace(/[\\/:*?"<>|#%]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
  return cleaned.slice(0, 80) || 'untitled'
}

function getDifficultyTier(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 'gray'
  if (n < 1200) return 'gray'
  if (n < 1400) return 'green'
  if (n < 1600) return 'cyan'
  if (n < 1900) return 'blue'
  if (n < 2100) return 'purple'
  if (n < 2400) return 'orange'
  return 'red'
}

// 문제 URL에서 플랫폼과 표시용 이름을 추론 (네트워크 없이 URL 패턴만 사용)
function parseProblemUrl(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  const path = u.pathname
  let m
  if (host.endsWith('codeforces.com')) {
    m = path.match(/\/problemset\/problem\/(\d+)\/(\w+)/) || path.match(/\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/)
    return { platform: 'Codeforces', name: m ? `CF ${m[1]}${m[2].toUpperCase()}` : '' }
  }
  if (host.endsWith('atcoder.jp')) {
    m = path.match(/\/contests\/[^/]+\/tasks\/(\w+)/)
    return { platform: 'AtCoder', name: m ? m[1].split('_').join(' ').toUpperCase() : '' }
  }
  if (host.endsWith('acmicpc.net')) {
    m = path.match(/\/problem\/(\d+)/)
    return { platform: 'BOJ', name: m ? `BOJ ${m[1]}` : '' }
  }
  if (host.endsWith('usaco.org')) {
    const cpid = u.searchParams.get('cpid')
    return { platform: 'USACO', name: cpid ? `USACO ${cpid}` : '' }
  }
  return { platform: 'Other', name: '' }
}

// 문제 URL → 저지 AC 매칭 키 ("cf:1850A" | "ac:abc300_a"). 매칭 불가 URL은 null.
// solved.ac(BOJ)와 kenkoooo problems.json은 브라우저 CORS 차단이라 대상에서 제외 (실측 확인).
function judgeKeyFromUrl(url) {
  if (!url) return null
  let u
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host.endsWith('codeforces.com')) {
    const m = u.pathname.match(/\/problemset\/problem\/(\d+)\/(\w+)/) || u.pathname.match(/\/(?:contest|gym)\/(\d+)\/problem\/(\w+)/)
    return m ? `cf:${m[1]}${m[2].toUpperCase()}` : null
  }
  if (host.endsWith('atcoder.jp')) {
    const m = u.pathname.match(/\/contests\/[^/]+\/tasks\/(\w+)/)
    return m ? `ac:${m[1].toLowerCase()}` : null
  }
  return null
}

// 인박스 한 줄 → 문제 필드. "이름 URL" 혼합, URL 단독, 텍스트 단독 모두 허용
function parseProblemLine(line) {
  const trimmed = line.trim().replace(/^[-*•]\s*/, '')
  if (!trimmed) return null
  const url = trimmed.match(/https?:\/\/\S+/)?.[0] || ''
  const parsed = url ? parseProblemUrl(url) : null
  const name = trimmed.replace(url, '').trim() || parsed?.name || (url ? url.replace(/^https?:\/\//, '').slice(0, 60) : '')
  if (!name) return null
  return { name, url, platform: parsed?.platform || 'Other' }
}

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

function buildFrontMatter(note) {
  const dateStr = formatDate(new Date(note.updatedAt || Date.now()))
  const title = (note.title || '제목 없음').replace(/"/g, '\\"')
  const category = note.category ? `"${note.category.replace(/"/g, '\\"')}"` : ''
  const tags = (note.tags || []).map((t) => `"${t.replace(/"/g, '\\"')}"`).join(', ')
  return ['---', `title: "${title}"`, `date: ${dateStr} 00:00:00 +0900`, `categories: [${category}]`, `tags: [${tags}]`, '---', '', ''].join(
    '\n',
  )
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function fromBase64(b64) {
  const binary = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))
}

// --- 이미지 에셋 (data 리포 assets/ 업로드 + IndexedDB 로컬 캐시) ---
// 노트 본문엔 ![](assets/<id>.<ext>) 짧은 링크만. 실체 blob은 IndexedDB에 캐시하고
// 데이터 리포 assets/<id>.<ext>로 업로드해 기기 간 동기화한다(private 리포라 프리뷰는 캐시/API로 로드).
const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
}
const isAssetPath = (p) => p.startsWith('assets/')
// path -> object URL. 붙여넣기 즉시 채워 프리뷰가 IndexedDB 왕복 없이 바로 표시.
const assetCache = new Map()

const IDB_NAME = 'cplog'
const IDB_STORE = 'assets'
let idbPromise = null
function openIdb() {
  if (idbPromise) return idbPromise
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return idbPromise
}
async function idbPutAsset(key, blob) {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
async function idbGetAsset(key) {
  const db = await openIdb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

// Blob -> 순수 base64(데이터 URI 프리픽스 제거) — GitHub Contents API PUT 바디용
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).slice(String(r.result).indexOf(',') + 1))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
// base64 문자열 -> 바이너리 Uint8Array (Contents API GET 응답 디코드)
function base64ToBytes(b64) {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function ghFetch(pat, path, opts = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  })
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

function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const timerRef = useRef(null)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(state))
      } catch {
        // localStorage unavailable (e.g. private mode quota) — fail silently
      }
    }, 300)
    return () => clearTimeout(timerRef.current)
  }, [key, state])

  return [state, setState]
}

// ---------------------------------------------------------------------------
// GitHub 데이터 리포 동기화 엔진
// problems.json + folders.json + notes/<id>.md 를 별도 private 리포에 Pull/Push.
// PAT·설정·테마는 동기화 대상에서 제외 (절대 리포에 올리지 않음).
// ---------------------------------------------------------------------------

const SYNC_PUSH_DEBOUNCE_MS = 4000
const SYNC_META_DEFAULT = { files: {}, lastSyncAt: null, dirty: [], deleted: [] }

function isSyncConfigured(s) {
  return !!(s.username?.trim() && s.dataRepo?.trim() && s.pat?.trim())
}

const noteIdFromPath = (path) => path.slice('notes/'.length, -'.md'.length)
const isNotePath = (path) => path.startsWith('notes/') && path.endsWith('.md')
const snippetIdFromPath = (path) => path.slice('snippets/'.length, -'.md'.length)
const isSnippetPath = (path) => path.startsWith('snippets/') && path.endsWith('.md')

function useGithubSync({ settings, notes, setNotes, problems, setProblems, snippets, setSnippets, folders, setFolders, addToast }) {
  const [syncMeta, setSyncMeta] = useLocalStorageState(LS_KEYS.SYNC, SYNC_META_DEFAULT)
  const [status, setStatus] = useState('off') // off | idle | dirty | syncing | error

  // 대기 중인 변경(dirty)/삭제 목록은 새로고침에도 살아남도록 localStorage에 미러링
  const dirtyRef = useRef(null)
  const deleteRef = useRef(null)
  if (dirtyRef.current === null) dirtyRef.current = new Set(syncMeta.dirty || [])
  if (deleteRef.current === null) deleteRef.current = new Set(syncMeta.deleted || [])

  const syncingRef = useRef(false)
  const pushTimerRef = useRef(null)
  const syncedKeyRef = useRef(null)

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const notesRef = useRef(notes)
  notesRef.current = notes
  const problemsRef = useRef(problems)
  problemsRef.current = problems
  const snippetsRef = useRef(snippets)
  snippetsRef.current = snippets
  const foldersRef = useRef(folders)
  foldersRef.current = folders
  // path -> blob sha 맵의 단일 진실 공급원. pull/push가 직접 갱신하고 persist가
  // localStorage로 미러링한다 (React 상태 왕복에 기대면 pull 직후 push가 stale 맵을 읽음)
  const filesRef = useRef(null)
  if (filesRef.current === null) filesRef.current = { ...(syncMeta.files || {}) }
  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  const ghData = useCallback((subPath, opts) => {
    const s = settingsRef.current
    return ghFetch(s.pat, `/repos/${s.username.trim()}/${s.dataRepo.trim()}${subPath}`, opts)
  }, [])

  const persist = useCallback(
    (files) => {
      setSyncMeta((m) => ({
        files: files ?? m.files ?? {},
        lastSyncAt: files ? Date.now() : m.lastSyncAt,
        dirty: [...dirtyRef.current],
        deleted: [...deleteRef.current],
      }))
    },
    [setSyncMeta],
  )

  const pull = useCallback(async () => {
    const branch = settingsRef.current.dataBranch?.trim() || 'main'
    const treeRes = await ghData(`/git/trees/${branch}?recursive=1`)
    if (treeRes.status === 404) throw Object.assign(new Error('데이터 리포를 찾을 수 없습니다.'), { code: 'DATA_REPO_MISSING' })
    if (!treeRes.ok) throw new Error((await safeJson(treeRes))?.message || `원격 목록 조회 실패 (${treeRes.status})`)

    const entries = ((await treeRes.json()).tree || []).filter(
      (e) =>
        e.type === 'blob' &&
        (e.path === 'problems.json' || e.path === 'folders.json' || isNotePath(e.path) || isSnippetPath(e.path) || isAssetPath(e.path)),
    )
    const remoteShas = Object.fromEntries(entries.map((e) => [e.path, e.sha]))
    const files = { ...filesRef.current }

    // 원격 변경분 채택 — 로컬에서 편집 중(dirty)인 파일은 로컬 우선(push가 덮어씀)
    for (const entry of entries) {
      if (files[entry.path] === entry.sha || dirtyRef.current.has(entry.path)) continue
      // 이미지 에셋은 통째로 내려받지 않고 sha만 기록(지연 로드) — 프리뷰가 참조할 때 API로 가져와 캐시
      if (isAssetPath(entry.path)) {
        files[entry.path] = entry.sha
        continue
      }
      const res = await ghData(`/contents/${entry.path}?ref=${branch}`)
      if (!res.ok) continue
      const text = fromBase64((await res.json()).content || '')
      if (entry.path === 'problems.json') {
        try {
          const arr = JSON.parse(text)
          if (Array.isArray(arr)) setProblems(arr)
        } catch {
          continue
        }
      } else if (entry.path === 'folders.json') {
        try {
          const arr = JSON.parse(text)
          if (Array.isArray(arr)) setFolders(arr)
        } catch {
          continue
        }
      } else if (isNotePath(entry.path)) {
        const note = markdownToNote(text)
        if (!note) continue
        setNotes((prev) => {
          const idx = prev.findIndex((n) => n.id === note.id)
          if (idx === -1) return [note, ...prev]
          const next = [...prev]
          next[idx] = note
          return next
        })
      } else {
        // 스니펫 채택. 외부(VS Code 등)에서 front matter 없이 만든 파일이거나 id-경로가
        // 불일치하면 파일명을 이름으로 채택하고 표준 경로(snippets/<id>.md)로 정규화 커밋
        // — 원본 파일은 삭제 큐에 등록해 리포에 중복이 남지 않게 한다.
        const snip = markdownToSnippet(text) ?? {
          id: uid(),
          name: snippetIdFromPath(entry.path),
          content: text,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        setSnippets((prev) => {
          const idx = prev.findIndex((s) => s.id === snip.id)
          if (idx === -1) return [...prev, snip]
          const next = [...prev]
          next[idx] = snip
          return next
        })
        if (entry.path !== `snippets/${snip.id}.md`) {
          files[entry.path] = entry.sha
          deleteRef.current.add(entry.path)
          dirtyRef.current.add(`snippets/${snip.id}.md`)
          continue
        }
      }
      files[entry.path] = entry.sha
    }

    // 원격에서 삭제된 파일(이전에 동기화했던 것)은 로컬에서도 제거
    for (const path of Object.keys(files)) {
      if (remoteShas[path] || dirtyRef.current.has(path) || deleteRef.current.has(path)) continue
      if (isNotePath(path)) {
        const id = noteIdFromPath(path)
        setNotes((prev) => prev.filter((n) => n.id !== id))
      } else if (isSnippetPath(path)) {
        const id = snippetIdFromPath(path)
        setSnippets((prev) => prev.filter((s) => s.id !== id))
      }
      delete files[path]
    }

    // 첫 연결: 원격에 아직 없는 로컬 데이터는 push 대상으로 등록
    if (problemsRef.current.length && !remoteShas['problems.json']) dirtyRef.current.add('problems.json')
    if (foldersRef.current.length && !remoteShas['folders.json']) dirtyRef.current.add('folders.json')
    for (const n of notesRef.current) {
      const p = `notes/${n.id}.md`
      if (!remoteShas[p] && !files[p] && !deleteRef.current.has(p)) dirtyRef.current.add(p)
    }
    for (const s of snippetsRef.current) {
      const p = `snippets/${s.id}.md`
      if (!remoteShas[p] && !files[p] && !deleteRef.current.has(p)) dirtyRef.current.add(p)
    }

    filesRef.current = files
    persist(files)
  }, [ghData, setNotes, setProblems, setSnippets, setFolders, persist])

  const push = useCallback(async () => {
    const branch = settingsRef.current.dataBranch?.trim() || 'main'
    const files = { ...filesRef.current }

    for (const path of [...deleteRef.current]) {
      const sha = files[path]
      if (sha) {
        const doDelete = (shaToUse) =>
          ghData(`/contents/${path}`, {
            method: 'DELETE',
            body: JSON.stringify({ message: `sync: delete ${path}`, sha: shaToUse, branch }),
          })
        let res = await doDelete(sha)
        if (res.status === 409 || res.status === 422) {
          const gr = await ghData(`/contents/${path}?ref=${branch}`)
          if (gr.ok) res = await doDelete((await gr.json()).sha)
        }
        if (!res.ok && res.status !== 404) throw new Error((await safeJson(res))?.message || `${path} 삭제 실패 (${res.status})`)
      }
      delete files[path]
      deleteRef.current.delete(path)
    }

    for (const path of [...dirtyRef.current]) {
      // 이미지 에셋: IndexedDB blob을 base64로 직접 업로드(텍스트 인코딩·병합 로직 없음)
      if (isAssetPath(path)) {
        let blob = null
        try {
          blob = await idbGetAsset(path)
        } catch {
          // IndexedDB 접근 불가(프라이빗 모드 등) — 업로드 스킵
        }
        if (!blob) {
          dirtyRef.current.delete(path)
          continue
        }
        const b64 = await blobToBase64(blob)
        const doPutAsset = (sha) =>
          ghData(`/contents/${path}`, {
            method: 'PUT',
            body: JSON.stringify({ message: `sync: ${path}`, content: b64, branch, ...(sha ? { sha } : {}) }),
          })
        let ares = await doPutAsset(files[path])
        if (ares.status === 409 || ares.status === 422) {
          const gr = await ghData(`/contents/${path}?ref=${branch}`)
          if (gr.ok) ares = await doPutAsset((await gr.json()).sha)
        }
        if (!ares.ok) throw new Error((await safeJson(ares))?.message || `${path} 업로드 실패 (${ares.status})`)
        files[path] = (await ares.json()).content.sha
        dirtyRef.current.delete(path)
        continue
      }
      let content
      if (path === 'problems.json') {
        content = JSON.stringify(problemsRef.current, null, 2)
      } else if (path === 'folders.json') {
        content = JSON.stringify(foldersRef.current, null, 2)
      } else if (isSnippetPath(path)) {
        const snippet = snippetsRef.current.find((s) => s.id === snippetIdFromPath(path))
        if (!snippet) {
          dirtyRef.current.delete(path)
          continue
        }
        content = snippetToMarkdown(snippet)
      } else {
        const note = notesRef.current.find((n) => n.id === noteIdFromPath(path))
        if (!note) {
          dirtyRef.current.delete(path)
          continue
        }
        content = noteToMarkdown(note)
      }
      const doPut = (sha) =>
        ghData(`/contents/${path}`, {
          method: 'PUT',
          body: JSON.stringify({ message: `sync: ${path}`, content: toBase64(content), branch, ...(sha ? { sha } : {}) }),
        })
      let res = await doPut(files[path])
      if (res.status === 409 || res.status === 422) {
        // sha 불일치: 원격 노트가 더 최신이면 원격 채택, 아니면 새 sha로 재시도 1회
        const gr = await ghData(`/contents/${path}?ref=${branch}`)
        if (gr.ok) {
          const remote = await gr.json()
          if (isNotePath(path)) {
            const remoteNote = markdownToNote(fromBase64(remote.content || ''))
            const localNote = notesRef.current.find((n) => n.id === noteIdFromPath(path))
            if (remoteNote && localNote && remoteNote.updatedAt > localNote.updatedAt) {
              setNotes((prev) => prev.map((n) => (n.id === remoteNote.id ? remoteNote : n)))
              files[path] = remote.sha
              dirtyRef.current.delete(path)
              addToastRef.current('success', `"${remoteNote.title || 'untitled'}" — 다른 기기의 더 최신 버전을 가져왔습니다.`)
              continue
            }
          } else if (isSnippetPath(path)) {
            const remoteSnip = markdownToSnippet(fromBase64(remote.content || ''))
            const localSnip = snippetsRef.current.find((s) => s.id === snippetIdFromPath(path))
            if (remoteSnip && localSnip && remoteSnip.updatedAt > localSnip.updatedAt) {
              setSnippets((prev) => prev.map((s) => (s.id === remoteSnip.id ? remoteSnip : s)))
              files[path] = remote.sha
              dirtyRef.current.delete(path)
              addToastRef.current('success', `"${remoteSnip.name || 'untitled'}" 스니펫 — 다른 기기의 더 최신 버전을 가져왔습니다.`)
              continue
            }
          }
          res = await doPut(remote.sha)
        }
      }
      if (!res.ok) throw new Error((await safeJson(res))?.message || `${path} 업로드 실패 (${res.status})`)
      files[path] = (await res.json()).content.sha
      dirtyRef.current.delete(path)
    }

    filesRef.current = files
    persist(files)
  }, [ghData, setNotes, setSnippets, persist])

  const runSync = useCallback(
    async (withPull) => {
      const s = settingsRef.current
      if (!isSyncConfigured(s) || syncingRef.current) return
      syncingRef.current = true
      clearTimeout(pushTimerRef.current)
      setStatus('syncing')
      try {
        if (withPull) await pull()
        await push()
        setStatus(dirtyRef.current.size || deleteRef.current.size ? 'dirty' : 'idle')
      } catch (err) {
        setStatus('error')
        if (err.code === 'DATA_REPO_MISSING') {
          addToastRef.current('error', `데이터 리포 '${s.dataRepo}'를 찾을 수 없습니다. 설정에서 리포를 생성하거나 이름을 확인해주세요.`)
        } else {
          addToastRef.current('error', `동기화 실패: ${err.message}`)
        }
      } finally {
        syncingRef.current = false
      }
    },
    [pull, push],
  )

  const schedulePush = useCallback(() => {
    const s = settingsRef.current
    if (!isSyncConfigured(s) || s.autoSync === false) return
    clearTimeout(pushTimerRef.current)
    pushTimerRef.current = setTimeout(() => runSync(false), SYNC_PUSH_DEBOUNCE_MS)
  }, [runSync])

  const markDirty = useCallback(
    (path) => {
      if (!dirtyRef.current.has(path)) {
        dirtyRef.current.add(path)
        persist()
      }
      setStatus((st) => (st === 'off' || st === 'syncing' ? st : 'dirty'))
      schedulePush()
    },
    [persist, schedulePush],
  )

  const queueDelete = useCallback(
    (path) => {
      dirtyRef.current.delete(path)
      if (filesRef.current[path]) deleteRef.current.add(path)
      persist()
      setStatus((st) => (st === 'off' || st === 'syncing' ? st : dirtyRef.current.size || deleteRef.current.size ? 'dirty' : st))
      schedulePush()
    },
    [persist, schedulePush],
  )

  const createDataRepo = useCallback(async (s) => {
    const res = await ghFetch(s.pat, '/user/repos', {
      method: 'POST',
      body: JSON.stringify({ name: s.dataRepo.trim(), private: true, auto_init: true }),
    })
    if (res.status === 201) return { ok: true, message: `'${s.dataRepo}' private 리포를 생성했습니다. 저장하면 동기화가 시작됩니다.` }
    const data = await safeJson(res)
    if (res.status === 422 && /already exists/i.test(JSON.stringify(data || {}))) {
      return { ok: true, message: '리포가 이미 존재합니다. 저장하면 동기화가 시작됩니다.' }
    }
    return { ok: false, message: `리포 생성 실패: ${data?.message || `HTTP ${res.status}`} — PAT 권한이 부족하면 GitHub에서 직접 생성해주세요.` }
  }, [])

  // 시작/설정 변경 시 자동 Pull+Push (설정 조합이 같으면 1회만 — StrictMode 이중 실행 가드 겸용)
  useEffect(() => {
    if (!isSyncConfigured(settings)) {
      setStatus('off')
      syncedKeyRef.current = null
      return
    }
    const key = [settings.username, settings.dataRepo, settings.dataBranch, settings.pat, settings.autoSync].join('\0')
    if (syncedKeyRef.current === key) return
    syncedKeyRef.current = key
    setStatus(dirtyRef.current.size || deleteRef.current.size ? 'dirty' : 'idle')
    if (settings.autoSync !== false) runSync(true)
  }, [settings, runSync])

  useEffect(() => () => clearTimeout(pushTimerRef.current), [])

  return {
    status,
    lastSyncAt: syncMeta.lastSyncAt,
    syncNow: () => runSync(true),
    markDirty,
    queueDelete,
    createDataRepo,
  }
}

// ---------------------------------------------------------------------------
// Small shared UI pieces
// ---------------------------------------------------------------------------

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const meta = TOAST_STYLE[t.type] || TOAST_STYLE.success
        const Icon = meta.icon
        return (
          <div key={t.id} className={cn('pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg', meta.cls)}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-[13px] leading-snug">{t.message}</p>
            <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

function NavItem({ icon: Icon, label, active, collapsed, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'relative flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0' : 'px-3',
        active ? 'bg-accent-soft text-accent-strong' : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {badge > 0 &&
        (collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" />
        ) : (
          <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning">{badge}</span>
        ))}
    </button>
  )
}

function SyncIndicator({ status, lastSyncAt, collapsed, onClick }) {
  const META = {
    off: { icon: CloudOff, cls: 'text-ink-faint', label: '동기화 꺼짐', sub: '설정에서 데이터 리포 연결' },
    idle: { icon: Cloud, cls: 'text-success', label: '동기화됨', sub: lastSyncAt ? formatDateTime(lastSyncAt) : null },
    dirty: { icon: CloudUpload, cls: 'text-warning', label: '동기화 대기 중', sub: '클릭하여 지금 동기화' },
    syncing: { icon: RefreshCw, cls: 'text-accent', label: '동기화 중...', sub: null, spin: true },
    error: { icon: TriangleAlert, cls: 'text-danger', label: '동기화 오류', sub: '클릭하여 재시도' },
  }
  const meta = META[status] || META.off
  const Icon = meta.icon
  return (
    <button
      onClick={onClick}
      title={collapsed ? meta.label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-surface-alt',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      <Icon size={17} strokeWidth={2} className={cn('shrink-0', meta.cls, meta.spin && 'animate-spin')} />
      {!collapsed && (
        <span className="min-w-0 text-left">
          <span className="block truncate text-ink-muted">{meta.label}</span>
          {meta.sub && <span className="block truncate text-[10.5px] font-normal text-ink-faint">{meta.sub}</span>}
        </span>
      )}
    </button>
  )
}

// 폴더 트리 헬퍼 — parentId 기반 중첩. 부모가 사라진 폴더(동기화 경합 등)는 루트로 승격해 잃지 않는다.
function buildFolderTree(folders) {
  const ids = new Set(folders.map((f) => f.id))
  const byParent = new Map()
  const sorted = [...folders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
  for (const f of sorted) {
    const parent = f.parentId && ids.has(f.parentId) ? f.parentId : null
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(f)
  }
  return byParent
}

const noteDragPayload = 'text/cplog-note'

function SidebarNoteRow({ note, active, selected, depth, onRowClick, onDragStartNote, onDelete }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStartNote(e, note.id)}
      className={cn(
        'group mb-0.5 flex items-center gap-1 rounded-lg py-1 pr-1',
        selected ? 'bg-accent-soft ring-1 ring-inset ring-accent/50' : active ? 'bg-accent-soft' : 'hover:bg-surface-alt',
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <button onClick={(e) => onRowClick(e, note.id)} className="min-w-0 flex-1 select-none rounded-lg px-1.5 py-1 text-left">
        <p className={cn('truncate text-[12.5px] font-semibold', active || selected ? 'text-accent-strong' : 'text-ink')}>
          {note.title || '제목 없음'}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-faint">
          {note.published ? <CheckCircle2 size={10} className="text-success" /> : <Clock size={10} />}
          {note.published ? '발행됨' : '초안'}
        </p>
      </button>
      <button
        onClick={() => onDelete(note.id)}
        className="shrink-0 rounded p-1 text-ink-faint opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function parseNoteDragIds(e) {
  try {
    return JSON.parse(e.dataTransfer.getData(noteDragPayload))
  } catch {
    return null
  }
}

function FolderTreeNode({ folder, depth, byParent, notes, activeNoteId, selectedNotes, collapsedFolders, actions }) {
  const [dragOver, setDragOver] = useState(false)
  const open = !collapsedFolders.includes(folder.id)
  const childFolders = byParent.get(folder.id) || []
  const childNotes = notes.filter((n) => n.folderId === folder.id)
  const color = FOLDER_COLORS[folder.color]
  return (
    <div>
      <div
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes(noteDragPayload)) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.stopPropagation()
          setDragOver(false)
          const ids = parseNoteDragIds(e)
          if (ids) actions.onMoveNotes(ids, folder.id)
        }}
        className={cn(
          'group mb-0.5 flex items-center gap-0.5 rounded-lg py-1 pr-1',
          dragOver ? 'bg-accent-soft outline-dashed outline-1 outline-accent' : 'hover:bg-surface-alt',
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button onClick={() => actions.onToggleFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left">
          <ChevronRight size={12} className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-90')} />
          {folder.emoji ? (
            <span className="w-4 shrink-0 text-center text-[13px] leading-none">{folder.emoji}</span>
          ) : (
            <Folder size={14} className={cn('shrink-0', !color && 'text-ink-muted')} style={color ? { color } : undefined} />
          )}
          <span className={cn('min-w-0 flex-1 truncate text-[12.5px] font-semibold', !color && 'text-ink')} style={color ? { color } : undefined}>
            {folder.name}
          </span>
        </button>
        <span className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
          <button
            onClick={() => actions.onNewNoteInFolder(folder.id)}
            title="이 폴더에 새 노트"
            className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-accent"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => actions.onEditFolder(folder)}
            title="폴더 편집"
            className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-ink"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={() => actions.onDeleteFolder(folder)}
            title="폴더 삭제"
            className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={11} />
          </button>
        </span>
      </div>
      {open && (
        <div>
          {childFolders.map((f) => (
            <FolderTreeNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              byParent={byParent}
              notes={notes}
              activeNoteId={activeNoteId}
              selectedNotes={selectedNotes}
              collapsedFolders={collapsedFolders}
              actions={actions}
            />
          ))}
          {childNotes.map((n) => (
            <SidebarNoteRow
              key={n.id}
              note={n}
              active={n.id === activeNoteId}
              selected={selectedNotes.has(n.id)}
              depth={depth + 1}
              onRowClick={actions.onNoteRowClick}
              onDragStartNote={actions.onDragStartNote}
              onDelete={actions.onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({
  activeView,
  onNavigate,
  onOpenSettings,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  notes,
  folders,
  collapsedFolders,
  folderActions,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onNewFolder,
  onDeleteNote,
  syncStatus,
  lastSyncAt,
  onSyncClick,
  reviewDueCount,
}) {
  const showNotesList = activeView === 'editor' && !collapsed
  const byParent = buildFolderTree(folders)
  const folderIds = new Set(folders.map((f) => f.id))
  const rootFolders = byParent.get(null) || []
  // 폴더가 없는(또는 폴더가 사라진) 노트는 루트에
  const rootNotes = notes.filter((n) => !n.folderId || !folderIds.has(n.folderId))

  // 노트 다중 선택 (클릭=열기+단일선택 / Shift=범위 / Ctrl=토글) + 선택 통째 폴더 드래그
  const [selectedNotes, setSelectedNotes] = useState(() => new Set())
  const noteAnchorRef = useRef(null)

  // Shift-범위용 보이는(펼쳐진 폴더) 노트의 렌더 순서 — 폴더의 하위폴더 먼저, 그다음 그 폴더 노트, 마지막에 루트 노트
  const visibleNoteOrder = []
  const walkNotes = (folder) => {
    if (collapsedFolders.includes(folder.id)) return
    for (const f of byParent.get(folder.id) || []) walkNotes(f)
    for (const n of notes.filter((n) => n.folderId === folder.id)) visibleNoteOrder.push(n.id)
  }
  for (const f of rootFolders) walkNotes(f)
  for (const n of rootNotes) visibleNoteOrder.push(n.id)

  const onNoteRowClick = (e, id) => {
    if (e.shiftKey && noteAnchorRef.current != null) {
      const a = visibleNoteOrder.indexOf(noteAnchorRef.current)
      const b = visibleNoteOrder.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        setSelectedNotes(new Set(visibleNoteOrder.slice(lo, hi + 1)))
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedNotes((s) => {
        const n = new Set(s)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      })
      noteAnchorRef.current = id
    } else {
      setSelectedNotes(new Set([id]))
      noteAnchorRef.current = id
      onSelectNote(id)
    }
  }

  const onDragStartNote = (e, id) => {
    const ids = selectedNotes.has(id) ? [...selectedNotes] : [id]
    if (!selectedNotes.has(id)) {
      setSelectedNotes(new Set([id]))
      noteAnchorRef.current = id
    }
    e.dataTransfer.setData(noteDragPayload, JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }

  const treeActions = { ...folderActions, onNoteRowClick, onDragStartNote, onDeleteNote }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-150',
        collapsed ? 'w-14' : 'w-64',
      )}
    >
      <div className={cn('flex items-center gap-2.5 py-4', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <Github size={17} strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-sans text-[15px] font-bold leading-none text-ink">CP-Log</p>
            <p className="mt-1 truncate text-[11px] text-ink-faint">PS 개인 노트</p>
          </div>
        )}
      </div>

      <nav className="space-y-1 px-2.5">
        <NavItem
          icon={LayoutGrid}
          label="풀 문제"
          active={activeView === 'board'}
          collapsed={collapsed}
          onClick={() => onNavigate('board')}
          badge={reviewDueCount}
        />
        <NavItem icon={FileText} label="에디터" active={activeView === 'editor'} collapsed={collapsed} onClick={() => onNavigate('editor')} />
        <NavItem icon={ChartColumn} label="통계" active={activeView === 'stats'} collapsed={collapsed} onClick={() => onNavigate('stats')} />
      </nav>

      {showNotesList ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-border pt-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">노트</span>
            <div className="flex items-center gap-0.5">
              <button onClick={onNewFolder} title="새 폴더" className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-accent">
                <FolderPlus size={14} />
              </button>
              <button
                onClick={onNewNote}
                title="새 노트 (Ctrl+Alt+N)"
                className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-accent"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {selectedNotes.size > 1 && (
            <p className="mx-2 mb-1 flex items-center justify-between rounded-md bg-accent-soft px-2 py-1 text-[10.5px] text-accent-strong">
              <span className="font-semibold">{selectedNotes.size}개 선택 · 폴더로 드래그</span>
              <button onClick={() => setSelectedNotes(new Set())} className="text-ink-faint hover:text-ink">
                <X size={11} />
              </button>
            </p>
          )}
          {/* 리스트 빈 영역에 드롭하면 폴더 해제(루트로 이동) — 폴더 행 드롭은 stopPropagation으로 여기까지 오지 않음 */}
          <div
            className="flex-1 overflow-y-auto px-2 pb-2"
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes(noteDragPayload)) e.preventDefault()
            }}
            onDrop={(e) => {
              const ids = parseNoteDragIds(e)
              if (ids) folderActions.onMoveNotes(ids, null)
            }}
          >
            {notes.length === 0 && folders.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-ink-faint">아직 작성한 노트가 없습니다</p>
            )}
            {rootFolders.map((f) => (
              <FolderTreeNode
                key={f.id}
                folder={f}
                depth={0}
                byParent={byParent}
                notes={notes}
                activeNoteId={activeNoteId}
                selectedNotes={selectedNotes}
                collapsedFolders={collapsedFolders}
                actions={treeActions}
              />
            ))}
            {rootNotes.map((n) => (
              <SidebarNoteRow
                key={n.id}
                note={n}
                active={n.id === activeNoteId}
                selected={selectedNotes.has(n.id)}
                depth={0}
                onRowClick={onNoteRowClick}
                onDragStartNote={onDragStartNote}
                onDelete={onDeleteNote}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="space-y-1 border-t border-border px-2.5 py-3">
        <SyncIndicator status={syncStatus} lastSyncAt={lastSyncAt} collapsed={collapsed} onClick={onSyncClick} />
        <NavItem
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          collapsed={collapsed}
          onClick={onToggleTheme}
        />
        <NavItem icon={Settings} label="설정" collapsed={collapsed} onClick={onOpenSettings} />
        <NavItem
          icon={collapsed ? ChevronsRight : ChevronsLeft}
          label={collapsed ? '펼치기' : '접기'}
          collapsed={collapsed}
          onClick={onToggleCollapse}
        />
      </div>
    </aside>
  )
}

function TagChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-50 hover:opacity-100">
          <X size={10} />
        </button>
      )}
    </span>
  )
}

function DifficultyBadge({ difficulty }) {
  if (!difficulty) return null
  const tier = getDifficultyTier(difficulty)
  return (
    <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold', DIFFICULTY_TIER_BADGE[tier])}>
      {difficulty}
    </span>
  )
}

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cn('max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-muted">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------
// To Solve (Kanban) board
// ---------------------------------------------------------------------------

function BoardHeader({ onAddClick, count }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4">
      <div>
        <h1 className="text-lg font-bold text-ink">To Solve</h1>
        <p className="text-xs text-ink-muted">{count}개의 문제를 추적하고 있습니다</p>
      </div>
      <button onClick={onAddClick} className="cp-btn-primary">
        <Plus size={16} /> 상세 추가
      </button>
    </div>
  )
}

// "복사 → 붙여넣기 → 끝" 문제 캡처 바.
// URL 단독 붙여넣기는 즉시 등록, 여러 줄 붙여넣기는 줄 단위 일괄 등록,
// 일반 텍스트(제목)는 Enter로 등록. "이름 URL" 혼합 한 줄도 지원.
function QuickAddBar({ onAdd, groups }) {
  const [value, setValue] = useState('')
  // 등록 대상 그룹(문제집) — 선택은 유지돼 셋 단위로 연속 등록하기 좋다
  const [group, setGroup] = useState('')
  const [newGroupMode, setNewGroupMode] = useState(false)
  const [newGroupDraft, setNewGroupDraft] = useState('')

  const commit = (text) => {
    const items = text.split(/\r?\n/).map(parseProblemLine).filter(Boolean)
    if (items.length) onAdd(items, group)
    setValue('')
  }

  const confirmNewGroup = () => {
    const name = newGroupDraft.trim()
    if (name) setGroup(name)
    setNewGroupMode(false)
    setNewGroupDraft('')
  }

  return (
    <div className="border-b border-border px-6 py-2.5">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 transition-colors focus-within:border-accent">
        <Zap size={14} className="shrink-0 text-ink-faint" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault()
              commit(value)
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (!text) return
            if (text.includes('\n')) {
              // 여러 줄: 입력창을 거치지 않고 즉시 일괄 등록
              e.preventDefault()
              commit(value ? `${value}\n${text}` : text)
            } else if (!value && /^https?:\/\/\S+$/.test(text.trim())) {
              // URL 단독: 붙여넣는 즉시 등록 (제목을 함께 쓰고 싶으면 먼저 타이핑 후 붙여넣기)
              e.preventDefault()
              commit(text)
            }
          }}
          placeholder="링크나 제목 붙여넣기 — URL은 즉시 추가, 여러 줄은 한꺼번에 추가"
          className="w-full bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
        {value.trim() && <span className="shrink-0 font-mono text-[10px] text-ink-faint">Enter ↵</span>}
        <div className="flex shrink-0 items-center gap-1 border-l border-border pl-2.5">
          {newGroupMode ? (
            <input
              autoFocus
              value={newGroupDraft}
              onChange={(e) => setNewGroupDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  confirmNewGroup()
                } else if (e.key === 'Escape') {
                  setNewGroupMode(false)
                  setNewGroupDraft('')
                }
              }}
              onBlur={confirmNewGroup}
              placeholder="새 그룹 이름"
              className="w-32 bg-transparent py-2 text-xs text-ink outline-none placeholder:text-ink-faint"
            />
          ) : (
            <select
              value={group}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setNewGroupMode(true)
                  setNewGroupDraft('')
                } else {
                  setGroup(e.target.value)
                }
              }}
              title="등록할 그룹(문제집)"
              className={cn(
                'max-w-40 cursor-pointer bg-transparent py-2 text-xs outline-none',
                group ? 'font-semibold text-accent-strong' : 'text-ink-faint',
              )}
            >
              <option value="">그룹 없음</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              {group && !groups.includes(group) && <option value={group}>{group}</option>}
              <option value="__new__">+ 새 그룹…</option>
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

const STATUS_SELECT_CLS = {
  todo: 'text-ink-muted',
  done: 'text-success',
}

// 고밀도 리스트 뷰 — 한 줄 = 한 문제. 상태 셀렉트는 changeProblemStatus 공통 경로.
// 그룹 없는 문제 섹션의 접기 상태 키 — 그룹 이름과 충돌하지 않는 예약 문자열
const UNGROUPED_KEY = '__cplog_ungrouped__'
const problemDragPayload = 'text/cplog-problems'

function ProblemTable({
  problems,
  onEdit,
  onDelete,
  onStatusChange,
  collapsedGroups,
  onToggleGroup,
  onRenameGroup,
  onClearGroup,
  onGroupProblems,
  onSetProblemsGroup,
  onMergeOntoProblem,
  onDeleteProblems,
}) {
  // 다중 선택(클릭/Shift-범위/Ctrl-토글) + 우클릭 메뉴 + 그룹 드래그
  const [selected, setSelected] = useState(() => new Set())
  const anchorRef = useRef(null)
  const [menu, setMenu] = useState(null) // null | {x, y}
  const [dropKey, setDropKey] = useState(null) // 'prob:<id>' | 'group:<key>'
  const clear = () => setSelected(new Set())

  const sortRows = (arr) =>
    [...arr].sort((a, b) => (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) || (b.createdAt || 0) - (a.createdAt || 0))

  // 그룹(문제집)별 섹션 — 최근에 문제가 추가된 그룹부터, '그룹 없음'은 맨 뒤.
  // 그룹이 하나도 없으면 섹션 헤더 없이 기존 단일 표 그대로.
  const byGroup = new Map()
  for (const p of problems) {
    const g = p.group || ''
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(p)
  }
  const latest = (arr) => Math.max(...arr.map((p) => p.createdAt || 0))
  const named = [...byGroup.entries()]
    .filter(([g]) => g)
    .sort((a, b) => latest(b[1]) - latest(a[1]))
    .map(([g, arr]) => ({ key: g, name: g, rows: sortRows(arr), named: true }))
  const sections = named.length
    ? [...named, ...(byGroup.has('') ? [{ key: UNGROUPED_KEY, name: '그룹 없음', rows: sortRows(byGroup.get('')), named: false }] : [])]
    : [{ key: null, rows: sortRows(problems) }]

  // Shift-범위 선택을 위한 보이는(펼쳐진 섹션) 행들의 평면 순서
  const flatIds = []
  for (const sec of sections) {
    if (sec.key === null || !collapsedGroups.includes(sec.key)) for (const p of sec.rows) flatIds.push(p.id)
  }

  const selectRow = (e, id) => {
    if (e.shiftKey && anchorRef.current != null) {
      const a = flatIds.indexOf(anchorRef.current)
      const b = flatIds.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        setSelected(new Set(flatIds.slice(lo, hi + 1)))
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => {
        const n = new Set(s)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      })
      anchorRef.current = id
    } else {
      setSelected(new Set([id]))
      anchorRef.current = id
    }
  }

  const hasDrag = (e) => [...e.dataTransfer.types].includes(problemDragPayload)
  const parseIds = (e) => {
    try {
      return JSON.parse(e.dataTransfer.getData(problemDragPayload))
    } catch {
      return null
    }
  }

  // 컨텍스트 메뉴는 외부 클릭/Esc/스크롤로 닫기
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [menu])

  const runMenu = (fn) => () => {
    fn()
    setMenu(null)
    clear()
  }

  const renderRow = (p) => {
    const isSel = selected.has(p.id)
    return (
      <tr
        key={p.id}
        draggable
        onDragStart={(e) => {
          const ids = isSel ? [...selected] : [p.id]
          if (!isSel) {
            setSelected(new Set([p.id]))
            anchorRef.current = p.id
          }
          e.dataTransfer.setData(problemDragPayload, JSON.stringify(ids))
          e.dataTransfer.effectAllowed = 'move'
        }}
        onDragOver={(e) => {
          if (hasDrag(e)) {
            e.preventDefault()
            setDropKey(`prob:${p.id}`)
          }
        }}
        onDragLeave={() => setDropKey((k) => (k === `prob:${p.id}` ? null : k))}
        onDrop={(e) => {
          e.stopPropagation()
          setDropKey(null)
          const ids = parseIds(e)
          if (ids) {
            onMergeOntoProblem(ids, p)
            clear()
          }
        }}
        onClick={(e) => selectRow(e, p.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          if (!isSel) {
            setSelected(new Set([p.id]))
            anchorRef.current = p.id
          }
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className={cn(
          'group cursor-pointer select-none border-b border-border/60',
          isSel ? 'bg-accent-soft' : 'hover:bg-surface-alt/50',
          dropKey === `prob:${p.id}` && 'outline-dashed outline-1 -outline-offset-1 outline-accent',
          p.status === 'done' && !isSel && 'opacity-55',
        )}
      >
        <td className="py-1 pr-3">
          <select
            value={p.status}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onStatusChange(p.id, e.target.value)}
            className={cn(
              'w-full cursor-pointer rounded-md border border-transparent bg-transparent py-1 text-xs font-semibold outline-none hover:border-border',
              STATUS_SELECT_CLS[p.status],
            )}
          >
            {COLUMNS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1 pr-3">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-ink">{p.name}</span>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="shrink-0 text-ink-faint hover:text-accent"
              >
                <ExternalLink size={12} />
              </a>
            )}
          </span>
        </td>
        <td className="py-1 pr-3">
          <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', PLATFORM_BADGE[p.platform] || PLATFORM_BADGE.Other)}>
            {p.platform}
          </span>
        </td>
        <td className="py-1 pr-3">
          <DifficultyBadge difficulty={p.difficulty} />
        </td>
        <td className="py-1 pr-3">
          <div className="flex flex-wrap gap-1">
            {p.tags?.map((t) => (
              <TagChip key={t}>{t}</TagChip>
            ))}
          </div>
        </td>
        <td className="py-1">
          <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(p)
              }}
              className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-ink"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(p)
              }}
              className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2" onClick={(e) => e.target === e.currentTarget && clear()}>
      {problems.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-xs text-ink-faint">
          문제가 없습니다 — 위 입력창에 링크를 붙여넣어 보세요
        </p>
      ) : (
        <>
          {selected.size > 0 && (
            <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs">
              <span className="font-semibold text-accent-strong">{selected.size}개 선택</span>
              <button
                onClick={() => {
                  onGroupProblems([...selected])
                  clear()
                }}
                className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 font-medium text-ink hover:border-accent"
              >
                <FolderPlus size={12} /> 새 그룹으로 묶기
              </button>
              <button
                onClick={() => {
                  onSetProblemsGroup([...selected], '')
                  clear()
                }}
                className="rounded-md border border-border bg-surface px-2 py-1 font-medium text-ink hover:border-accent"
              >
                그룹에서 빼기
              </button>
              <button
                onClick={() => {
                  onDeleteProblems([...selected])
                  clear()
                }}
                className="rounded-md border border-border bg-surface px-2 py-1 font-medium text-danger hover:bg-danger-soft"
              >
                삭제
              </button>
              <span className="ml-auto text-[10.5px] text-ink-muted">드래그로 그룹에 넣기 · 우클릭 메뉴</span>
              <button onClick={clear} className="rounded p-0.5 text-ink-faint hover:text-ink">
                <X size={13} />
              </button>
            </div>
          )}
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                <th className="w-32 py-2 pr-3 font-semibold">상태</th>
                <th className="py-2 pr-3 font-semibold">문제</th>
                <th className="w-24 py-2 pr-3 font-semibold">플랫폼</th>
                <th className="w-16 py-2 pr-3 font-semibold">난이도</th>
                <th className="w-56 py-2 pr-3 font-semibold">태그</th>
                <th className="w-14 py-2" />
              </tr>
            </thead>
            {sections.map((sec) => {
              const open = sec.key === null || !collapsedGroups.includes(sec.key)
              const done = sec.rows.filter((p) => p.status === 'done').length
              const isDropSec = dropKey === `group:${sec.key}`
              return (
                <tbody key={sec.key ?? '__all__'}>
                  {sec.key !== null && (
                    <tr
                      className="group/sec"
                      onDragOver={(e) => {
                        if (hasDrag(e)) {
                          e.preventDefault()
                          setDropKey(`group:${sec.key}`)
                        }
                      }}
                      onDragLeave={() => setDropKey((k) => (k === `group:${sec.key}` ? null : k))}
                      onDrop={(e) => {
                        e.stopPropagation()
                        setDropKey(null)
                        const ids = parseIds(e)
                        if (ids) {
                          onSetProblemsGroup(ids, sec.named ? sec.name : '')
                          clear()
                        }
                      }}
                    >
                      <td colSpan={6} className={cn('rounded-md pb-1 pt-4', isDropSec && 'bg-accent-soft outline-dashed outline-1 outline-accent')}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => onToggleGroup(sec.key)} className="flex min-w-0 items-center gap-1.5 text-left">
                            <ChevronRight size={13} className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-90')} />
                            <span className="truncate text-[13px] font-bold text-ink">{sec.name}</span>
                          </button>
                          <span className={cn('shrink-0 font-mono text-[11px]', done === sec.rows.length ? 'text-success' : 'text-ink-faint')}>
                            {done}/{sec.rows.length} 해결
                          </span>
                          {sec.named && (
                            <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/sec:opacity-100">
                              <button
                                onClick={() => onRenameGroup(sec.name)}
                                title="그룹 이름 변경"
                                className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-ink"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={() => onClearGroup(sec.name)}
                                title="그룹 해제 — 문제는 '그룹 없음'으로 이동"
                                className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {open && sec.rows.map(renderRow)}
                </tbody>
              )
            })}
          </table>
        </>
      )}

      {menu && (
        <div
          className="fixed z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 text-[13px] shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={runMenu(() => onGroupProblems([...selected]))}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-surface-alt"
          >
            <FolderPlus size={13} /> 새 그룹으로 묶기 ({selected.size}개)
          </button>
          <button
            onClick={runMenu(() => onSetProblemsGroup([...selected], ''))}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-surface-alt"
          >
            <X size={13} /> 그룹에서 빼기
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={runMenu(() => onDeleteProblems([...selected]))}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger hover:bg-danger-soft"
          >
            <Trash2 size={13} /> 삭제 ({selected.size}개)
          </button>
        </div>
      )}
    </div>
  )
}

// 복습 큐 스트립 — reviewAt이 설정된 문제를 기한순으로 나열, 기한 도래는 warning 강조
function ReviewStrip({ problems, onRetry, onComplete }) {
  const items = problems.filter((p) => p.reviewAt != null).sort((a, b) => a.reviewAt - b.reviewAt)
  if (items.length === 0) return null
  const now = Date.now()
  return (
    <div className="border-b border-border bg-surface-alt/40 px-6 py-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        <CalendarClock size={12} /> 복습 큐
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((p) => {
          const due = now >= p.reviewAt
          const label = due
            ? now - p.reviewAt < DAY_MS
              ? '오늘'
              : `${Math.floor((now - p.reviewAt) / DAY_MS)}일 지남`
            : `D-${Math.ceil((p.reviewAt - now) / DAY_MS)}`
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-xs',
                due ? 'border-warning/40 bg-warning-soft text-warning' : 'border-border bg-surface text-ink-muted',
              )}
            >
              <span className="max-w-48 truncate font-semibold">{p.name}</span>
              <span className={cn('font-mono text-[10.5px]', due ? 'font-bold' : 'text-ink-faint')}>{label}</span>
              <button
                onClick={() => onRetry(p)}
                title="다시 풀기 (To Do로 이동)"
                className="rounded-full p-1 opacity-60 hover:bg-black/10 hover:opacity-100"
              >
                <RotateCcw size={12} />
              </button>
              <button onClick={() => onComplete(p)} title="복습 완료" className="rounded-full p-1 opacity-60 hover:bg-black/10 hover:opacity-100">
                <Check size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// To Solve 화면 전체 — 헤더 + 캡처 바 + 복습 스트립 + 고밀도 리스트
function ProblemBoard({
  problems,
  groups,
  onAddClick,
  onQuickAdd,
  onEdit,
  onDelete,
  onStatusChange,
  onReviewRetry,
  onReviewComplete,
  collapsedGroups,
  onToggleGroup,
  onRenameGroup,
  onClearGroup,
  onGroupProblems,
  onSetProblemsGroup,
  onMergeOntoProblem,
  onDeleteProblems,
}) {
  return (
    <div className="flex h-full flex-col">
      <BoardHeader count={problems.length} onAddClick={onAddClick} />
      <QuickAddBar onAdd={onQuickAdd} groups={groups} />
      <ReviewStrip problems={problems} onRetry={onReviewRetry} onComplete={onReviewComplete} />
      <ProblemTable
        problems={problems}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        collapsedGroups={collapsedGroups}
        onToggleGroup={onToggleGroup}
        onRenameGroup={onRenameGroup}
        onClearGroup={onClearGroup}
        onGroupProblems={onGroupProblems}
        onSetProblemsGroup={onSetProblemsGroup}
        onMergeOntoProblem={onMergeOntoProblem}
        onDeleteProblems={onDeleteProblems}
      />
    </div>
  )
}

function ProblemModal({ initial, groups, onClose, onSave }) {
  const isEdit = !!initial
  const [form, setForm] = useState(
    () =>
      initial ?? {
        name: '',
        url: '',
        platform: PLATFORMS[0],
        difficulty: '',
        tags: [],
        group: '',
        status: 'todo',
        reviewAt: null,
      },
  )
  const [tagDraft, setTagDraft] = useState('')

  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagDraft('')
  }
  const removeTag = (t) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, group: (form.group || '').trim(), id: initial?.id ?? uid(), createdAt: initial?.createdAt ?? Date.now() })
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? '문제 수정' : '문제 추가'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="문제 이름" required>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="cp-input"
            placeholder="예: Two Pointers 연습"
          />
        </Field>
        <Field label="문제 링크">
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="cp-input"
            placeholder="https://codeforces.com/problemset/problem/..."
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="플랫폼">
            <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} className="cp-input">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="난이도">
            <input
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              className="cp-input"
              placeholder="예: 1900"
            />
          </Field>
        </div>
        <Field label="그룹 (문제집)">
          <input
            value={form.group || ''}
            onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            list="cp-group-datalist"
            className="cp-input"
            placeholder="예: BOJ 단계별, ABC 412 (비우면 그룹 없음)"
          />
          <datalist id="cp-group-datalist">
            {(groups || []).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label="태그">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2">
            {form.tags.map((t) => (
              <TagChip key={t} onRemove={() => removeTag(t)}>
                {t}
              </TagChip>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && tagDraft.trim()) {
                  e.preventDefault()
                  addTag()
                }
                if (e.key === 'Backspace' && !tagDraft && form.tags.length) removeTag(form.tags[form.tags.length - 1])
              }}
              onBlur={addTag}
              placeholder={form.tags.length ? '' : '예: dp, greedy, 수론 (Enter로 추가)'}
              className="min-w-[8rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {TAG_SUGGESTIONS.filter((s) => !form.tags.includes(s))
              .slice(0, 6)
              .map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, tags: [...f.tags, s] }))}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-ink-faint hover:border-accent hover:text-accent"
                >
                  + {s}
                </button>
              ))}
          </div>
        </Field>
        {isEdit && (
          <Field label="상태">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="cp-input">
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// 문제가 Done으로 전환된 직후 복습 주기를 고르는 모달 (닫기 = "안 함")
function ReviewModal({ problem, onSelect, onClose }) {
  return (
    <ModalShell title="복습 예약" onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-bold">"{problem.name}"</span> 문제를 해결했습니다. 언제 다시 풀어볼까요?
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">기한이 되면 To Solve 보드 상단의 복습 큐에서 알려드립니다.</p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {REVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.days)}
            className={cn(
              'rounded-lg border py-2.5 text-[13px] font-semibold transition-colors',
              opt.days == null
                ? 'border-border text-ink-faint hover:bg-surface-alt hover:text-ink'
                : 'border-border text-ink hover:border-accent hover:bg-accent-soft hover:text-accent-strong',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </ModalShell>
  )
}

// 폴더 생성/편집 모달 — initial이 id를 가지면 편집, {parentId}면 해당 위치에 새 폴더
function FolderModal({ initial, folders, onClose, onSave }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => (isEdit ? { ...initial } : { name: '', emoji: '', color: '', parentId: initial?.parentId ?? null }))

  // 자기 자신과 자손은 상위 폴더 후보에서 제외 (순환 방지)
  const descendants = useMemo(() => {
    if (!isEdit) return new Set()
    const set = new Set([initial.id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of folders) {
        if (f.parentId && set.has(f.parentId) && !set.has(f.id)) {
          set.add(f.id)
          grew = true
        }
      }
    }
    return set
  }, [isEdit, initial, folders])

  // 상위 폴더 셀렉트 라벨은 전체 경로("부모 / 자식")로 표시
  const pathById = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    const pathOf = (f) => {
      const parts = [f.name]
      const seen = new Set([f.id])
      let cur = f
      while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
        cur = byId.get(cur.parentId)
        seen.add(cur.id)
        parts.unshift(cur.name)
      }
      return parts.join(' / ')
    }
    return new Map(folders.map((f) => [f.id, pathOf(f)]))
  }, [folders])

  const parentOptions = folders
    .filter((f) => !descendants.has(f.id))
    .sort((a, b) => (pathById.get(a.id) || '').localeCompare(pathById.get(b.id) || '', 'ko'))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...form,
      name: form.name.trim(),
      emoji: (form.emoji || '').trim(),
      parentId: form.parentId || null,
      id: initial?.id ?? uid(),
      createdAt: initial?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? '폴더 편집' : '새 폴더'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="폴더 이름" required>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="cp-input"
            placeholder="예: 대회 기록"
          />
        </Field>
        <Field label="이모지">
          <div className="flex items-center gap-2">
            <input
              value={form.emoji || ''}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              maxLength={4}
              className="cp-input w-16 text-center"
              placeholder="—"
            />
            <div className="flex flex-wrap gap-1">
              {FOLDER_EMOJI_PRESETS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setForm((f) => ({ ...f, emoji: f.emoji === em ? '' : em }))}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg border text-[14px]',
                    form.emoji === em ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-alt',
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="색상">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: '' }))}
              title="색상 없음"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border',
                !form.color ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-alt',
              )}
            >
              <X size={11} className="text-ink-faint" />
            </button>
            {Object.entries(FOLDER_COLORS).map(([key, hex]) => (
              <button
                type="button"
                key={key}
                title={key}
                onClick={() => setForm((f) => ({ ...f, color: key }))}
                className={cn('h-6 w-6 rounded-full border-2 transition-transform', form.color === key ? 'scale-110 border-ink' : 'border-transparent')}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </Field>
        <Field label="상위 폴더">
          <select
            value={form.parentId || ''}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
            className="cp-input"
          >
            <option value="">(루트)</option>
            {parentOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {pathById.get(f.id)}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            {isEdit ? '저장' : '만들기'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// 새 노트 생성 시 시작 템플릿 선택 — 빈 노트 또는 스니펫(제목 템플릿 포함) 퀵픽
function NewNoteModal({ snippets, onClose, onCreate }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef(null)
  const items = [
    { key: '__blank__', icon: FileText, name: '빈 노트', sub: '내용 없이 시작', snippet: null },
    ...snippets.map((s) => ({
      key: s.id,
      icon: Braces,
      name: s.name || '이름 없음',
      sub: s.title ? `제목: ${s.title}` : null,
      snippet: s,
    })),
  ]

  useEffect(() => {
    boxRef.current?.focus()
  }, [])
  useEffect(() => {
    boxRef.current?.querySelector('[data-nn-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onCreate(items[activeIdx].snippet)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <ModalShell title="새 노트" onClose={onClose}>
      <div ref={boxRef} tabIndex={-1} onKeyDown={handleKeyDown} className="max-h-[50vh] overflow-y-auto outline-none">
        {items.map((item, i) => {
          const Icon = item.icon
          const isActive = i === activeIdx
          return (
            <button
              key={item.key}
              data-nn-active={isActive || undefined}
              onClick={() => onCreate(item.snippet)}
              onMouseMove={() => setActiveIdx(i)}
              className={cn(
                'mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left',
                isActive ? 'bg-accent-soft' : 'hover:bg-surface-alt',
              )}
            >
              <Icon size={15} className={cn('shrink-0', isActive ? 'text-accent-strong' : 'text-ink-faint')} />
              <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', isActive ? 'text-accent-strong' : 'text-ink')}>
                {item.name}
              </span>
              {item.sub && <span className="max-w-44 shrink-0 truncate text-[10.5px] text-ink-faint">{item.sub}</span>}
            </button>
          )
        })}
      </div>
      <p className="mt-3 flex items-center gap-3 text-[10.5px] text-ink-faint">
        <span>↑↓ 이동</span>
        <span>Enter 만들기</span>
        <span>Esc 닫기</span>
      </p>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function TagInlineAdd({ onAdd }) {
  const [val, setVal] = useState('')
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ',') && val.trim()) {
          e.preventDefault()
          onAdd(val.trim())
          setVal('')
        }
      }}
      placeholder="+ 태그"
      className="w-16 shrink-0 bg-transparent text-xs text-ink-muted outline-none placeholder:text-ink-faint focus:w-24 transition-all"
    />
  )
}

function SnippetDropdown({ snippets, disabled, onInsert, onManage }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q ? snippets.filter((s) => (s.name || '').toLowerCase().includes(q)) : snippets

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        onClick={() => {
          setOpen((o) => !o)
          setQuery('')
        }}
        disabled={disabled}
        title={disabled ? '편집 모드에서 사용할 수 있습니다' : '커서 위치에 스니펫 삽입'}
        className="cp-btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Braces size={15} /> 스니펫
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="스니펫 검색..."
            className="w-full border-b border-border bg-transparent px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          <div className="max-h-56 overflow-y-auto p-1.5">
            {filtered.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-ink-faint">스니펫이 없습니다</p>}
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setOpen(false)
                  onInsert(s)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-alt"
              >
                <span className="truncate text-[13px] font-medium text-ink">{s.name || '이름 없음'}</span>
                <span className="shrink-0 text-[10.5px] text-ink-faint">{formatDate(new Date(s.updatedAt))}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setOpen(false)
              onManage()
            }}
            className="flex w-full items-center gap-2 border-t border-border px-3.5 py-2.5 text-xs font-semibold text-ink-muted hover:bg-surface-alt hover:text-ink"
          >
            <Settings size={13} /> 스니펫 관리...
          </button>
        </div>
      )}
    </div>
  )
}

function EditorMetaBar({ note, onChange, onPublish, publishing, editorMode, onSetEditorMode, snippets, onInsertSnippet, onManageSnippets }) {
  return (
    <div className="border-b border-border bg-surface px-5 py-3.5">
      <div className="flex items-center gap-3">
        <input
          value={note.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="제목 없음"
          className="min-w-0 flex-1 bg-transparent text-lg font-bold text-ink outline-none placeholder:text-ink-faint"
        />
        <SnippetDropdown snippets={snippets} disabled={editorMode === 'preview'} onInsert={onInsertSnippet} onManage={onManageSnippets} />
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-surface-alt p-0.5">
          <button
            onClick={() => onSetEditorMode('edit')}
            title="편집 (Ctrl+E)"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
              editorMode !== 'preview' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
            )}
          >
            <Pencil size={13} /> 편집
          </button>
          <button
            onClick={() => onSetEditorMode('preview')}
            title="미리보기 (Ctrl+E)"
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
              editorMode === 'preview' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink',
            )}
          >
            <Eye size={13} /> 미리보기
          </button>
        </div>
        <button onClick={onPublish} disabled={publishing} className="cp-btn-primary shrink-0">
          {publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />}
          {publishing ? '발행 중...' : 'Publish'}
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <input
          value={note.category}
          onChange={(e) => onChange({ category: e.target.value })}
          placeholder="카테고리"
          className="w-32 rounded-md border border-border bg-surface-alt px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        />
        {note.tags.map((t) => (
          <TagChip key={t} onRemove={() => onChange({ tags: note.tags.filter((x) => x !== t) })}>
            {t}
          </TagChip>
        ))}
        <TagInlineAdd onAdd={(t) => onChange({ tags: [...note.tags, t] })} />
        <span className="ml-auto flex items-center gap-3 text-[11px] text-ink-faint">
          {note.published && (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 size={12} /> 발행됨
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={11} /> {formatDateTime(note.updatedAt)}
          </span>
        </span>
      </div>
    </div>
  )
}

// CodeMirror 테마 — 값을 전부 CSS 변수로 참조해 data-theme 전환 시 재생성 없이 자동 추종
const cmTheme = CMEditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { padding: '20px 0', caretColor: 'var(--color-ink)' },
  '.cm-line': { padding: '0 20px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-ink)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: 'var(--color-accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-surface-alt) 60%, transparent)' },
  '.cm-gutters': { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-faint)', borderRight: '1px solid var(--color-border)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--color-surface-alt) 60%, transparent)',
    color: 'var(--color-ink-muted)',
  },
  '.cm-placeholder': { color: 'var(--color-ink-faint)' },
  '.cm-panels': { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-ink)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--color-border)' },
  // CM 기본 테마가 패널 인풋/버튼에 font-size 70%를 강제해 너무 작게 보임 — 명시 크기로 덮어씀
  '.cm-panel.cm-search': { fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 40px 10px 14px' },
  '.cm-panel.cm-search .cm-textfield': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    outline: 'none',
    fontSize: '13px',
    padding: '5px 10px',
  },
  '.cm-panel.cm-search .cm-textfield:focus': { borderColor: 'var(--color-accent)' },
  '.cm-panel.cm-search input[type="checkbox"]': {
    width: '13px',
    height: '13px',
    verticalAlign: 'text-top',
    accentColor: 'var(--color-accent)',
    marginRight: '4px',
  },
  '.cm-panel.cm-search button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '12.5px',
    padding: '5px 12px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button:hover': { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-ink)' },
  '.cm-panel.cm-search [name="close"]': {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-ink-faint)',
    fontSize: '18px',
    lineHeight: '1',
    padding: '4px 8px',
    top: '8px',
    right: '8px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search [name="close"]:hover': { backgroundColor: 'transparent', color: 'var(--color-ink)' },
  '.cm-panel.cm-search label': { color: 'var(--color-ink-muted)', fontSize: '12.5px' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--color-warning) 55%, transparent)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-sans)', fontSize: '12.5px', maxHeight: '15em' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-accent-soft)',
    color: 'var(--color-accent-strong)',
  },
  '.cm-completionDetail': { color: 'var(--color-ink-faint)', fontStyle: 'normal', marginLeft: '0.8em' },
})

// 마크다운 + 임베디드 코드블록(cpp/python 등 lazy load) 구문 강조 — 프리뷰(hljs)와 같은 --code-* 토큰 사용
const cmHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-ink)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-accent-strong)' },
  { tag: tags.quote, color: 'var(--color-ink-muted)', fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--color-accent-strong)' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--color-ink-faint)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool], color: 'var(--code-number)' },
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName), tags.self], color: 'var(--code-builtin)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-title)', fontWeight: '600' },
  { tag: [tags.meta, tags.annotation], color: 'var(--code-meta)' },
])

const cmBaseExtensions = [
  lineNumbers(),
  highlightActiveLine(),
  history(),
  search(),
  CMEditorView.lineWrapping,
  markdown({ codeLanguages: languages }),
  syntaxHighlighting(cmHighlightStyle, { fallback: true }),
  cmTheme,
  cmPlaceholder('여기에 마크다운으로 풀이를 작성하세요...'),
  CMEditorView.contentAttributes.of({ spellcheck: 'false' }),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
]

// 붙여넣기/드롭한 이미지 파일을 assets/<id>.<ext> 파일로 처리하고 노트엔 ![](경로) 짧은 링크만 삽입.
// 실체 blob은 IndexedDB 캐시(+in-memory objectURL) → 프리뷰 즉시 표시, onAddAsset이 데이터 리포 업로드 큐에 등록.
const MAX_PASTE_IMAGE_BYTES = 10 * 1024 * 1024
function insertImageFile(view, file, pos, { onToast, onAddAsset }) {
  if (file.size > MAX_PASTE_IMAGE_BYTES) {
    onToast?.('error', '이미지가 너무 큽니다 (최대 10MB). 크기를 줄여주세요.')
    return
  }
  const ext = MIME_EXT[file.type] || 'png'
  const path = `assets/${uid()}.${ext}`
  // 프리뷰가 즉시 볼 수 있게 objectURL을 먼저 캐시하고, IndexedDB엔 영속 저장(백그라운드)
  assetCache.set(path, URL.createObjectURL(file))
  idbPutAsset(path, file).catch(() => {})
  onAddAsset?.(path)
  const at = pos ?? view.state.selection.main.from
  const insert = `![](${path})`
  view.dispatch({ changes: { from: at, to: at, insert }, selection: { anchor: at + insert.length } })
  view.focus()
}

function SourcePane({ noteId, content, onChange, viewRef, notes, problems, onToast, onAddAsset }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onToastRef = useRef(onToast)
  onToastRef.current = onToast
  const onAddAssetRef = useRef(onAddAsset)
  onAddAssetRef.current = onAddAsset
  // CM이 마지막으로 알고 있는 내용 — 외부 변경(원격 pull)과 자체 편집을 구분해 루프 방지
  const lastContentRef = useRef(null)
  // [[ 자동완성이 항상 최신 목록을 읽도록 ref로 전달 (extensions는 1회만 생성되므로)
  const linkDataRef = useRef(null)
  linkDataRef.current = { notes, problems }

  const extensionsRef = useRef(null)
  if (extensionsRef.current === null) {
    // 옵시디언식 [[ 링크 자동완성 — 노트는 [[제목]], 문제는 [이름](url)로 삽입
    const linkCompletionSource = (context) => {
      const match = context.matchBefore(/\[\[([^\]\n]*)$/)
      if (!match) return null
      const { notes: ns, problems: ps } = linkDataRef.current
      const options = [
        ...ns
          .filter((n) => n.title?.trim())
          .map((n) => ({ label: n.title, detail: '노트', apply: `${n.title}]]` })),
        ...ps.map((p) => ({
          label: p.name,
          detail: p.platform,
          apply: (view, _completion, from, to) => {
            const insert = p.url ? `[${p.name}](${p.url})` : p.name
            // 여는 [[까지 포함해 통째로 마크다운 링크로 치환
            view.dispatch({
              changes: { from: from - 2, to, insert },
              selection: { anchor: from - 2 + insert.length },
            })
          },
        })),
      ]
      return { from: match.from + 2, options, validFor: /^[^\]\n]*$/ }
    }
    // 클립보드/드래그의 이미지 파일 → assets/ 삽입. 이미지가 없으면 false 반환해 기본 동작(텍스트) 유지.
    const imgHandlers = () => ({ onToast: onToastRef.current, onAddAsset: onAddAssetRef.current })
    const imageEventHandlers = CMEditorView.domEventHandlers({
      paste: (event, view) => {
        const items = [...(event.clipboardData?.items || [])]
        const item = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
        if (!item) return false
        const file = item.getAsFile()
        if (!file) return false
        event.preventDefault()
        insertImageFile(view, file, null, imgHandlers())
        return true
      },
      drop: (event, view) => {
        const file = [...(event.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
        if (!file) return false // 사이드바 노트 DnD 등 파일 아닌 드롭은 그대로 통과
        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        insertImageFile(view, file, pos, imgHandlers())
        return true
      },
    })
    extensionsRef.current = [
      ...cmBaseExtensions,
      imageEventHandlers,
      autocompletion({ override: [linkCompletionSource], icons: false }),
      keymap.of([
        {
          key: 'Mod-Shift-l',
          run: (view) => {
            const { from, to } = view.state.selection.main
            view.dispatch({ changes: { from, to, insert: '[[' }, selection: { anchor: from + 2 } })
            startCompletion(view)
            return true
          },
        },
      ]),
      CMEditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        // 원격 반영용 dispatch(Transaction.remote 주석)는 앱 상태로 되돌리지 않음
        if (update.transactions.every((tr) => tr.annotation(Transaction.remote))) return
        const text = update.state.doc.toString()
        lastContentRef.current = text
        onChangeRef.current(text)
      }),
    ]
  }

  // 뷰 생성(1회) + 노트 전환 시 문서/undo 히스토리 리셋
  useEffect(() => {
    if (!viewRef.current) viewRef.current = new CMEditorView({ parent: containerRef.current })
    lastContentRef.current = content
    viewRef.current.setState(EditorState.create({ doc: content || '', extensions: extensionsRef.current }))
  }, [noteId])

  useEffect(
    () => () => {
      viewRef.current?.destroy()
      viewRef.current = null
    },
    [],
  )

  // 같은 노트의 content가 밖에서 바뀐 경우(원격 pull 채택 등) 문서 교체
  useEffect(() => {
    const view = viewRef.current
    if (!view || content === lastContentRef.current) return
    const current = view.state.doc.toString()
    lastContentRef.current = content
    if (content === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content || '' },
      annotations: Transaction.remote.of(true),
    })
  }, [content])

  return <div ref={containerRef} className="h-full overflow-hidden bg-surface" />
}

// [[제목]] 위키링크를 링크 노드(#wiki:제목)로 바꾸는 remark 플러그인.
// code/inlineCode는 children 없이 value만 가지므로 재귀에서 자연히 제외된다.
const WIKILINK_RE = /\[\[([^\][\n]+?)\]\]/g

function remarkWikiLinks() {
  const transform = (node) => {
    if (!Array.isArray(node.children)) return
    const next = []
    for (const child of node.children) {
      if (child.type !== 'text') {
        transform(child)
        next.push(child)
        continue
      }
      const value = child.value
      let last = 0
      let m
      WIKILINK_RE.lastIndex = 0
      while ((m = WIKILINK_RE.exec(value))) {
        if (m.index > last) next.push({ type: 'text', value: value.slice(last, m.index) })
        next.push({ type: 'link', url: `#wiki:${encodeURIComponent(m[1])}`, children: [{ type: 'text', value: m[1] }] })
        last = m.index + m[0].length
      }
      if (last === 0) next.push(child)
      else if (last < value.length) next.push({ type: 'text', value: value.slice(last) })
    }
    node.children = next
  }
  return transform
}

// assets/ 경로 이미지를 로컬 캐시(→IndexedDB→데이터 리포 API) 순으로 비동기 해석해 표시.
// data:/http(s) 등 그 외 src는 그대로. (구버전 base64 노트 호환)
function AssetImage({ src, alt, resolveAsset }) {
  const [state, setState] = useState(() => (isAssetPath(src || '') ? { status: 'loading', url: null } : { status: 'ok', url: src }))
  useEffect(() => {
    if (!isAssetPath(src || '')) {
      setState({ status: 'ok', url: src })
      return
    }
    let alive = true
    setState({ status: 'loading', url: null })
    Promise.resolve(resolveAsset?.(src)).then((u) => {
      if (alive) setState(u ? { status: 'ok', url: u } : { status: 'missing', url: null })
    })
    return () => {
      alive = false
    }
  }, [src, resolveAsset])

  if (state.status === 'loading')
    return <span className="inline-block rounded bg-surface-alt px-2 py-1 text-[11px] text-ink-faint">이미지 불러오는 중…</span>
  if (state.status === 'missing')
    return <span className="inline-block rounded bg-surface-alt px-2 py-1 text-[11px] text-ink-faint">🖼️ 이미지를 찾을 수 없습니다 (동기화 필요)</span>
  return <img src={state.url} alt={alt || ''} />
}

function MarkdownPreview({ content, notes, onOpenWikiLink, resolveAsset }) {
  const noteTitles = useMemo(() => new Set(notes.map((n) => (n.title || '').trim()).filter(Boolean)), [notes])
  return (
    <div className="h-full overflow-y-auto bg-surface p-5">
      <div className="cp-prose mx-auto max-w-2xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath, remarkWikiLinks]}
          rehypePlugins={[rehypeKatex, rehypeHighlight]}
          // 기본 urlTransform은 data:·상대경로를 필터링 — 이미지 data URI(구버전)와 assets/ 상대경로를 통과시킴
          urlTransform={(url) => (url.startsWith('data:image/') || isAssetPath(url) ? url : defaultUrlTransform(url))}
          components={{
            // eslint-disable-next-line no-unused-vars
            img({ src, alt, node, ...props }) {
              return <AssetImage src={src} alt={alt} resolveAsset={resolveAsset} {...props} />
            },
            // eslint-disable-next-line no-unused-vars
            a({ href, children, node, ...props }) {
              if (href?.startsWith('#wiki:')) {
                const title = decodeURIComponent(href.slice('#wiki:'.length))
                const exists = noteTitles.has(title.trim())
                return (
                  <a
                    href={href}
                    className={cn('cp-wikilink', !exists && 'cp-wikilink-missing')}
                    title={exists ? `"${title}" 노트 열기` : `"${title}" 노트 만들기`}
                    onClick={(e) => {
                      e.preventDefault()
                      onOpenWikiLink(title)
                    }}
                  >
                    {children}
                  </a>
                )
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              )
            },
          }}
        >
          {content || '_미리보기가 여기에 표시됩니다._'}
        </ReactMarkdown>
      </div>
    </div>
  )
}

// 현재 노트를 [[제목]]으로 언급한 노트 목록 (옵시디언 백링크 관례)
function BacklinksBar({ activeNote, notes, onSelectNote }) {
  const title = (activeNote.title || '').trim()
  const backlinks = useMemo(
    () => (title ? notes.filter((n) => n.id !== activeNote.id && (n.content || '').includes(`[[${title}]]`)) : []),
    [notes, activeNote.id, title],
  )
  if (backlinks.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-5 py-2">
      <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
        <Link2 size={11} /> 백링크 {backlinks.length}
      </span>
      {backlinks.map((n) => (
        <button
          key={n.id}
          onClick={() => onSelectNote(n.id)}
          className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-ink-muted hover:border-accent hover:text-accent"
        >
          {n.title || '제목 없음'}
        </button>
      ))}
    </div>
  )
}

function EmptyEditorState({ onNew }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <FileText size={32} className="text-ink-faint" />
      <p className="text-sm text-ink-muted">
        아직 열린 노트가 없습니다.
        <br />
        To Solve 보드에서 문제를 Done으로 옮기거나 새 노트를 만들어보세요.
      </p>
      <button onClick={onNew} className="cp-btn-primary mt-1">
        <Plus size={15} /> 새 노트 만들기
      </button>
    </div>
  )
}

function EditorView({
  activeNote,
  onNewNote,
  onUpdateNote,
  onPublish,
  publishing,
  editorMode,
  onSetEditorMode,
  snippets,
  onManageSnippets,
  notes,
  problems,
  onOpenWikiLink,
  onSelectNote,
  onToast,
  onAddAsset,
  resolveAsset,
}) {
  const cmViewRef = useRef(null)

  // 커서 위치에 변수 치환된 스니펫 삽입, {{cursor}} 지점으로 캐럿 이동
  const insertSnippet = (snippet) => {
    const view = cmViewRef.current
    if (!activeNote || !view) return
    // 제목 없는 노트에 제목 템플릿 있는 스니펫을 삽입하면 노트 제목도 함께 설정
    const snippetTitle = renderSnippetVars(snippet.title || '').trim()
    const applyTitle = !!snippetTitle && !(activeNote.title || '').trim()
    if (applyTitle) onUpdateNote(activeNote.id, { title: snippetTitle })
    const { text, cursorOffset } = renderSnippet(snippet.content, { title: applyTitle ? snippetTitle : activeNote.title })
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + cursorOffset },
      scrollIntoView: true,
    })
    view.focus()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {activeNote ? (
        <>
          <EditorMetaBar
            note={activeNote}
            onChange={(patch) => onUpdateNote(activeNote.id, patch)}
            onPublish={() => onPublish(activeNote)}
            publishing={publishing}
            editorMode={editorMode}
            onSetEditorMode={onSetEditorMode}
            snippets={snippets}
            onInsertSnippet={insertSnippet}
            onManageSnippets={onManageSnippets}
          />
          <div className="flex-1 overflow-hidden">
            {editorMode === 'preview' ? (
              <MarkdownPreview content={activeNote.content} notes={notes} onOpenWikiLink={onOpenWikiLink} resolveAsset={resolveAsset} />
            ) : (
              <SourcePane
                noteId={activeNote.id}
                content={activeNote.content}
                onChange={(content) => onUpdateNote(activeNote.id, { content })}
                viewRef={cmViewRef}
                notes={notes}
                problems={problems}
                onToast={onToast}
                onAddAsset={onAddAsset}
              />
            )}
          </div>
          <BacklinksBar activeNote={activeNote} notes={notes} onSelectNote={onSelectNote} />
        </>
      ) : (
        <EmptyEditorState onNew={onNewNote} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsModal({ settings, onClose, onSave, onCreateRepo }) {
  const [form, setForm] = useState(settings)
  const [creating, setCreating] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  const handleCreateRepo = async () => {
    setCreating(true)
    try {
      await onCreateRepo(form)
    } finally {
      setCreating(false)
    }
  }

  return (
    <ModalShell title="GitHub 블로그 설정" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="GitHub Username" required>
          <input
            autoFocus
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="cp-input"
            placeholder="octocat"
          />
        </Field>
        <Field label="Repository Name" required>
          <input
            value={form.repo}
            onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
            className="cp-input"
            placeholder="octocat.github.io"
          />
        </Field>
        <Field label="Branch">
          <input
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            className="cp-input"
            placeholder="main"
          />
        </Field>
        <Field label="Personal Access Token" required>
          <input
            type="password"
            value={form.pat}
            onChange={(e) => setForm((f) => ({ ...f, pat: e.target.value }))}
            className="cp-input font-mono"
            placeholder="ghp_..."
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            토큰은 이 브라우저의 localStorage에만 저장되며 외부로 전송되지 않습니다. 대상 저장소에 대한 Contents 읽기/쓰기 권한이 필요합니다.
          </p>
        </Field>

        <div className="pt-1">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">데이터 저장소 동기화</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="데이터 리포">
              <input
                value={form.dataRepo}
                onChange={(e) => setForm((f) => ({ ...f, dataRepo: e.target.value }))}
                className="cp-input"
                placeholder="cplog-data"
              />
            </Field>
            <Field label="데이터 브랜치">
              <input
                value={form.dataBranch}
                onChange={(e) => setForm((f) => ({ ...f, dataBranch: e.target.value }))}
                className="cp-input"
                placeholder="main"
              />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={form.autoSync !== false}
              onChange={(e) => setForm((f) => ({ ...f, autoSync: e.target.checked }))}
              className="h-3.5 w-3.5 accent-accent"
            />
            자동 동기화 (시작 시 가져오기 + 편집 후 자동 업로드)
          </label>
          <button
            type="button"
            onClick={handleCreateRepo}
            disabled={creating || !form.username.trim() || !form.pat.trim() || !form.dataRepo?.trim()}
            className="cp-btn-ghost mt-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 데이터 리포 생성 (private)
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            보드는 problems.json, 노트는 notes/*.md 파일로 저장됩니다. 리포를 클론하면 노트를 Obsidian 등에서 바로 열 수 있습니다.
          </p>
        </div>

        <div className="pt-1">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">저지 연동</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Codeforces 핸들">
              <input
                value={form.cfHandle || ''}
                onChange={(e) => setForm((f) => ({ ...f, cfHandle: e.target.value }))}
                className="cp-input"
                placeholder="tourist"
              />
            </Field>
            <Field label="AtCoder 핸들">
              <input
                value={form.atcoderHandle || ''}
                onChange={(e) => setForm((f) => ({ ...f, atcoderHandle: e.target.value }))}
                className="cp-input"
                placeholder="tourist"
              />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            핸들을 입력하면 시작 시 제출 이력을 읽어 AC된 문제를 자동으로 Done 처리합니다 (공개 API, 토큰 불필요). BOJ는 solved.ac가
            브라우저 호출을 막아 지원하지 않습니다.
          </p>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            <Check size={15} /> 저장
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Snippets manager
// ---------------------------------------------------------------------------

function SnippetsModal({ snippets, onClose, onCreate, onUpdate, onDelete, onImport, onExport }) {
  const [selectedId, setSelectedId] = useState(snippets[0]?.id ?? null)
  const selected = snippets.find((s) => s.id === selectedId) || null
  const fileRef = useRef(null)

  const handleCreate = () => setSelectedId(onCreate())

  const handleDelete = () => {
    if (!selected || !onDelete(selected.id)) return
    setSelectedId(snippets.find((s) => s.id !== selected.id)?.id ?? null)
  }

  const handleImport = async (e) => {
    const ids = await onImport(e.target.files)
    if (ids.length) setSelectedId(ids[ids.length - 1])
    e.target.value = ''
  }

  return (
    <ModalShell title="스니펫 관리" onClose={onClose} wide>
      <div className="grid grid-cols-[13rem_1fr] gap-5">
        <div className="flex max-h-[60vh] min-h-[20rem] flex-col rounded-xl border border-border">
          <div className="flex-1 overflow-y-auto p-1.5">
            {snippets.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-ink-faint">스니펫이 없습니다</p>}
            {snippets.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'mb-0.5 w-full rounded-lg px-2.5 py-2 text-left',
                  s.id === selectedId ? 'bg-accent-soft' : 'hover:bg-surface-alt',
                )}
              >
                <p className={cn('truncate text-[13px] font-semibold', s.id === selectedId ? 'text-accent-strong' : 'text-ink')}>
                  {s.name || '이름 없음'}
                </p>
                <p className="mt-0.5 text-[10.5px] text-ink-faint">{formatDateTime(s.updatedAt)}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-t border-border p-1.5">
            <button onClick={handleCreate} className="cp-btn-ghost flex-1 justify-center text-xs">
              <Plus size={13} /> 새로 만들기
            </button>
            <button onClick={() => fileRef.current?.click()} title=".md 파일 가져오기" className="cp-btn-ghost text-xs">
              <Upload size={13} />
            </button>
            <input ref={fileRef} type="file" accept=".md" multiple onChange={handleImport} className="hidden" />
          </div>
        </div>

        {selected ? (
          <div className="flex flex-col gap-3">
            <Field label="이름">
              <input value={selected.name} onChange={(e) => onUpdate(selected.id, { name: e.target.value })} className="cp-input" />
            </Field>
            <Field label="제목 템플릿">
              <input
                value={selected.title || ''}
                onChange={(e) => onUpdate(selected.id, { title: e.target.value })}
                className="cp-input"
                placeholder="예: {{date}} 오답노트 — 비우면 제목 미설정"
              />
            </Field>
            <Field label="내용">
              <textarea
                value={selected.content}
                onChange={(e) => onUpdate(selected.id, { content: e.target.value })}
                spellCheck={false}
                className="cp-input h-64 resize-none font-mono text-[12.5px] leading-relaxed"
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              사용 가능한 변수: {'{{date}}'} {'{{time}}'} {'{{datetime}}'} {'{{title}}'} {'{{cursor}}'} — 삽입 시 치환되며, {'{{cursor}}'}{' '}
              위치로 커서가 이동합니다. 제목 템플릿({'{{date}}'}/{'{{time}}'}/{'{{datetime}}'} 사용 가능)은 이 스니펫으로 새 노트를 만들거나
              제목 없는 노트에 삽입할 때 노트 제목이 됩니다.
            </p>
            <div className="flex justify-between">
              <button onClick={handleDelete} className="cp-btn-ghost text-danger hover:bg-danger-soft">
                <Trash2 size={14} /> 삭제
              </button>
              <button onClick={() => onExport(selected)} className="cp-btn-ghost">
                <Download size={14} /> .md 내보내기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Braces size={26} className="text-ink-faint" />
            <p className="text-xs text-ink-muted">
              왼쪽에서 스니펫을 선택하거나
              <br />새 스니펫을 만들어보세요.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// 통계 (스탯 타일 + 잔디 히트맵 + 태그 분포)
// ---------------------------------------------------------------------------

// 히트맵 명도 램프 — 단일 색상(accent) light→dark, 0은 무채색 표면
const HEAT_LEVELS = ['bg-surface-alt', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent']
const heatLevel = (count) => Math.min(4, count)

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
    </div>
  )
}

function StatsView({ problems, notes }) {
  const doneCount = problems.filter((p) => p.status === 'done').length
  const todoCount = problems.filter((p) => p.status !== 'done').length

  // 일별 활동 = 그날 해결한 문제(solvedAt) + 그날 만든 노트(createdAt)
  const activity = useMemo(() => {
    const m = new Map()
    const bump = (ts) => {
      if (!ts) return
      const k = formatDate(new Date(ts))
      m.set(k, (m.get(k) || 0) + 1)
    }
    for (const p of problems) if (p.status === 'done') bump(p.solvedAt)
    for (const n of notes) bump(n.createdAt)
    return m
  }, [problems, notes])

  // 최근 26주 · 일요일 시작 열 정렬 (GitHub 잔디 관례)
  const { weeks, monthLabels, recentTotal } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay() - 25 * 7)
    const weeks = []
    const monthLabels = []
    let lastMonth = -1
    let recentTotal = 0
    for (let w = 0; w < 26; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(start)
        day.setDate(start.getDate() + w * 7 + d)
        if (day > today) break
        const key = formatDate(day)
        const count = activity.get(key) || 0
        recentTotal += count
        col.push({ key, count })
      }
      const first = new Date(start)
      first.setDate(start.getDate() + w * 7)
      if (first.getMonth() !== lastMonth) {
        monthLabels.push({ w, label: `${first.getMonth() + 1}월` })
        lastMonth = first.getMonth()
      }
      weeks.push(col)
    }
    return { weeks, monthLabels, recentTotal }
  }, [activity])

  // 해결한 문제의 태그 상위 8개 — 단일 시리즈 가로 막대
  const tagCounts = useMemo(() => {
    const m = new Map()
    for (const p of problems) {
      if (p.status !== 'done') continue
      for (const t of p.tags || []) m.set(t, (m.get(t) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [problems])
  const maxTag = tagCounts[0]?.[1] || 1

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-bold text-ink">통계</h1>
        <p className="text-xs text-ink-muted">해결 기록과 노트 작성 활동을 한눈에</p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="추적 중인 문제" value={problems.length} />
          <StatTile label="해결 (Done)" value={doneCount} sub={problems.length ? `${Math.round((doneCount / problems.length) * 100)}%` : null} />
          <StatTile label="미해결 (To Do)" value={todoCount} />
          <StatTile label="작성한 노트" value={notes.length} />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-ink">활동 히트맵</h2>
            <span className="text-[11px] text-ink-muted">최근 26주 · 활동 {recentTotal}회</span>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="mb-1 flex gap-[3px] pl-8 text-[9.5px] text-ink-faint">
                {weeks.map((_, w) => {
                  const m = monthLabels.find((ml) => ml.w === w)
                  return (
                    <span key={w} className="w-[12px] shrink-0 overflow-visible whitespace-nowrap">
                      {m ? m.label : ''}
                    </span>
                  )
                })}
              </div>
              <div className="flex gap-[3px]">
                <div className="flex w-8 flex-col gap-[3px] pr-1 text-right text-[9.5px] leading-[12px] text-ink-faint">
                  {['', '월', '', '수', '', '금', ''].map((d, i) => (
                    <span key={i} className="h-[12px]">
                      {d}
                    </span>
                  ))}
                </div>
                {weeks.map((col, w) => (
                  <div key={w} className="flex flex-col gap-[3px]">
                    {col.map((cell) => (
                      <div
                        key={cell.key}
                        title={`${cell.key} · 활동 ${cell.count}회`}
                        className={cn('h-[12px] w-[12px] rounded-[3px]', HEAT_LEVELS[heatLevel(cell.count)])}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 text-[9.5px] text-ink-faint">
                적음
                {HEAT_LEVELS.map((cls) => (
                  <span key={cls} className={cn('h-[10px] w-[10px] rounded-[3px]', cls)} />
                ))}
                많음
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold text-ink">태그별 해결 분포</h2>
          {tagCounts.length === 0 ? (
            <p className="py-4 text-center text-xs text-ink-faint">아직 해결한 문제의 태그 데이터가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {tagCounts.map(([tag, count]) => (
                <div key={tag} className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-2">
                  <span className="truncate text-xs font-medium text-ink">{tag}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-alt">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(count / maxTag) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono text-xs text-ink-muted">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 세션 노트 (데일리 셋 기록) 원클릭 생성
// ---------------------------------------------------------------------------

// 사용자의 실제 기록 형식(예: 260709.md — "## A"~ 헤딩별 풀이 + "# Upsolving")을 템플릿화
function SessionNoteModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [count, setCount] = useState(6)

  const submit = (e) => {
    e.preventDefault()
    onCreate({ name: name.trim(), count: Math.min(12, Math.max(1, count || 1)) })
  }

  return (
    <ModalShell title="오늘 세션 노트" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="셋 이름 (선택)">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="cp-input"
            placeholder="예: DOJ BCD4, ABC 412"
          />
        </Field>
        <Field label="문제 개수">
          <input
            type="number"
            min={1}
            max={12}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            className="cp-input"
          />
          <p className="mt-1.5 text-[11px] text-ink-faint">A부터 {String.fromCharCode(64 + Math.min(12, Math.max(1, count || 1)))}까지 헤딩이 생성됩니다.</p>
        </Field>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            <CalendarPlus size={15} /> 만들기
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Ctrl+K 퀵 스위처
// ---------------------------------------------------------------------------

const QS_SECTION_LIMIT = 8 // 노트/문제 섹션당 최대 표시 수 — 넘치는 항목은 검색으로 좁히는 것을 전제

function QuickSwitcher({ notes, folders = [], problems, commands, onClose, onOpenNote, onOpenProblem }) {
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const listRef = useRef(null)

  // 노트 서브텍스트에 붙일 폴더 경로("부모 / 자식")
  const folderPathById = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    const pathOf = (f) => {
      const parts = [f.name]
      const seen = new Set([f.id])
      let cur = f
      while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
        cur = byId.get(cur.parentId)
        seen.add(cur.id)
        parts.unshift(cur.name)
      }
      return parts.join(' / ')
    }
    return new Map(folders.map((f) => [f.id, pathOf(f)]))
  }, [folders])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (...fields) => !q || fields.some((f) => (f || '').toLowerCase().includes(q))
    const result = []
    let count = 0
    for (const n of notes) {
      if (count >= QS_SECTION_LIMIT) break
      // 제목/태그 우선 매치, 아니면 본문 전문 검색 — 본문 매치는 주변 문맥을 서브텍스트로
      const inMeta = matches(n.title, (n.tags || []).join(' '))
      const contentIdx = !inMeta && q ? (n.content || '').toLowerCase().indexOf(q) : -1
      if (!inMeta && contentIdx === -1) continue
      const sub =
        contentIdx >= 0
          ? `…${(n.content || '').slice(Math.max(0, contentIdx - 12), contentIdx + q.length + 28).replace(/\s+/g, ' ')}…`
          : [folderPathById.get(n.folderId), (n.tags || []).join(', ')].filter(Boolean).join(' · ')
      result.push({
        key: `note-${n.id}`,
        section: '노트',
        icon: FileText,
        label: n.title || '제목 없음',
        sub,
        run: () => onOpenNote(n.id),
      })
      count += 1
    }
    count = 0
    for (const p of problems) {
      if (count >= QS_SECTION_LIMIT) break
      if (!matches(p.name, (p.tags || []).join(' '), p.platform)) continue
      result.push({
        key: `problem-${p.id}`,
        section: '문제',
        icon: LayoutGrid,
        label: p.name,
        sub: [p.platform, p.difficulty].filter(Boolean).join(' · '),
        run: () => onOpenProblem(p),
      })
      count += 1
    }
    for (const c of commands) {
      if (!matches(c.label)) continue
      result.push({ key: `cmd-${c.id}`, section: '명령', icon: c.icon, label: c.label, hint: c.hint, run: c.run })
    }
    return result
  }, [query, notes, problems, commands, onOpenNote, onOpenProblem, folderPathById])

  // 검색어가 바뀌면 첫 항목 선택, 결과가 줄면 범위 안으로 클램프
  const active = Math.min(activeIdx, Math.max(0, items.length - 1))
  useEffect(() => setActiveIdx(0), [query])

  useEffect(() => {
    listRef.current?.querySelector('[data-qs-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  const runItem = (item) => {
    onClose()
    item.run()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length) setActiveIdx((active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) runItem(items[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 p-4 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-ink-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노트 · 문제 · 명령 검색..."
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
        <div ref={listRef} className="max-h-[45vh] overflow-y-auto p-1.5">
          {items.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-faint">결과가 없습니다</p>}
          {items.map((item, i) => {
            const Icon = item.icon
            const isActive = i === active
            return (
              <div key={item.key}>
                {(i === 0 || items[i - 1].section !== item.section) && (
                  <p className="px-3 pb-1 pt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">{item.section}</p>
                )}
                <button
                  data-qs-active={isActive || undefined}
                  onClick={() => runItem(item)}
                  onMouseMove={() => setActiveIdx(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left',
                    isActive ? 'bg-accent-soft' : 'hover:bg-surface-alt',
                  )}
                >
                  <Icon size={15} className={cn('shrink-0', isActive ? 'text-accent-strong' : 'text-ink-faint')} />
                  <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium', isActive ? 'text-accent-strong' : 'text-ink')}>
                    {item.label}
                  </span>
                  {item.sub && <span className="max-w-40 shrink-0 truncate text-[10.5px] text-ink-faint">{item.sub}</span>}
                  {item.hint && <span className="shrink-0 font-mono text-[10px] text-ink-faint">{item.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[10.5px] text-ink-faint">
          <span>↑↓ 이동</span>
          <span>Enter 열기</span>
          <span>Esc 닫기</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  const [problems, setProblems] = useLocalStorageState(LS_KEYS.PROBLEMS, [])
  const [notes, setNotes] = useLocalStorageState(LS_KEYS.NOTES, [])
  const [folders, setFolders] = useLocalStorageState(LS_KEYS.FOLDERS, [])
  const [snippets, setSnippets] = useLocalStorageState(LS_KEYS.SNIPPETS, DEFAULT_SNIPPETS)
  const [githubSettings, setGithubSettings] = useLocalStorageState(LS_KEYS.GITHUB, DEFAULT_GITHUB_SETTINGS)
  const [uiState, setUiState] = useLocalStorageState(LS_KEYS.UI, {
    activeView: 'board',
    activeNoteId: null,
    sidebarCollapsed: false,
    editorMode: 'edit',
  })
  const [theme, setTheme] = useLocalStorageState(LS_KEYS.THEME, 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  const [toasts, setToasts] = useState([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [problemModal, setProblemModal] = useState(null) // null | {} | problem
  const [reviewModal, setReviewModal] = useState(null) // null | problem (Done 전환 직후 복습 주기 선택)
  const [folderModal, setFolderModal] = useState(null) // null | {parentId} | folder
  const [newNoteModal, setNewNoteModal] = useState(null) // null | {folderId} (새 노트 템플릿 선택)
  const [sessionNoteOpen, setSessionNoteOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const addToast = (type, message) => {
    const id = uid()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id))

  // 예전 버전에서 저장된 설정에는 dataRepo 등 새 필드가 없을 수 있어 기본값과 병합
  const gh = useMemo(() => ({ ...DEFAULT_GITHUB_SETTINGS, ...githubSettings }), [githubSettings])
  const {
    status: syncStatus,
    lastSyncAt,
    syncNow,
    markDirty,
    queueDelete,
    createDataRepo,
  } = useGithubSync({ settings: gh, notes, setNotes, problems, setProblems, snippets, setSnippets, folders, setFolders, addToast })

  const activeNote = notes.find((n) => n.id === uiState.activeNoteId) || null
  const navigate = (view) => setUiState((s) => ({ ...s, activeView: view }))
  const toggleSidebarCollapsed = () => setUiState((s) => ({ ...s, sidebarCollapsed: !s.sidebarCollapsed }))
  const setEditorMode = (mode) => setUiState((s) => ({ ...s, editorMode: mode }))

  const changeProblemStatus = (problemId, status) => {
    const problem = problems.find((p) => p.id === problemId)
    if (!problem || problem.status === status) return
    setProblems((prev) =>
      prev.map((p) => (p.id === problemId ? { ...p, status, solvedAt: status === 'done' ? (p.solvedAt ?? Date.now()) : p.solvedAt } : p)),
    )
    markDirty('problems.json')
    if (status === 'done') setReviewModal(problem)
  }

  const upsertProblem = (rawProblem) => {
    const prevProblem = problems.find((p) => p.id === rawProblem.id)
    const isNewlyDone = rawProblem.status === 'done' && prevProblem?.status !== 'done'
    const formProblem = isNewlyDone ? { ...rawProblem, solvedAt: rawProblem.solvedAt ?? Date.now() } : rawProblem
    setProblems((prev) => {
      const exists = prev.some((p) => p.id === formProblem.id)
      return exists ? prev.map((p) => (p.id === formProblem.id ? formProblem : p)) : [...prev, formProblem]
    })
    markDirty('problems.json')
    setProblemModal(null)
    if (isNewlyDone) setReviewModal(formProblem)
  }

  // 복습 주기 선택 (모달 닫기 = "안 함")
  const applyReviewChoice = (days) => {
    const problem = reviewModal
    setReviewModal(null)
    const reviewAt = days == null ? null : Date.now() + days * DAY_MS
    if (reviewAt !== (problem.reviewAt ?? null)) {
      setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, reviewAt } : p)))
      markDirty('problems.json')
    }
  }

  const retryReviewProblem = (problem) => {
    setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, status: 'todo', reviewAt: null } : p)))
    markDirty('problems.json')
  }

  const completeReviewProblem = (problem) => {
    setProblems((prev) => prev.map((p) => (p.id === problem.id ? { ...p, reviewAt: null } : p)))
    markDirty('problems.json')
  }

  const reviewDueCount = problems.filter((p) => p.reviewAt != null && Date.now() >= p.reviewAt).length

  // In Progress 상태 폐지(2026-07-13) — 로컬/원격에 남은 값은 To Do로 승격
  useEffect(() => {
    if (problems.some((p) => p.status === 'in_progress')) {
      setProblems((prev) => prev.map((p) => (p.status === 'in_progress' ? { ...p, status: 'todo' } : p)))
      markDirty('problems.json')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems])

  // --- 폴더 (에디터 노트 트리) ---

  const collapsedFolders = uiState.collapsedFolders || [] // 예전 저장분에는 키가 없음
  const toggleFolder = (id) =>
    setUiState((s) => {
      const cur = s.collapsedFolders || []
      return { ...s, collapsedFolders: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
    })

  const upsertFolder = (folder) => {
    setFolders((prev) => (prev.some((f) => f.id === folder.id) ? prev.map((f) => (f.id === folder.id ? folder : f)) : [...prev, folder]))
    markDirty('folders.json')
    setFolderModal(null)
  }

  // 폴더 삭제 — 안의 노트/하위 폴더는 지우지 않고 한 단계 위로 올린다
  const deleteFolder = (folder) => {
    if (!window.confirm(`"${folder.name}" 폴더를 삭제할까요?\n안의 노트와 하위 폴더는 상위로 이동합니다.`)) return
    const newParent = folder.parentId ?? null
    setFolders((prev) =>
      prev.filter((f) => f.id !== folder.id).map((f) => (f.parentId === folder.id ? { ...f, parentId: newParent, updatedAt: Date.now() } : f)),
    )
    const moved = notes.filter((n) => n.folderId === folder.id)
    if (moved.length) {
      setNotes((prev) => prev.map((n) => (n.folderId === folder.id ? { ...n, folderId: newParent, updatedAt: Date.now() } : n)))
      for (const n of moved) markDirty(`notes/${n.id}.md`)
    }
    markDirty('folders.json')
  }

  // 노트(단일/다중)를 폴더로 이동 — 드롭 페이로드는 항상 id 배열
  const moveNotesToFolder = (ids, folderId) => {
    const target = folderId ?? null
    const toMove = notes.filter((n) => ids.includes(n.id) && (n.folderId ?? null) !== target)
    if (!toMove.length) return
    const idSet = new Set(toMove.map((n) => n.id))
    setNotes((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, folderId: target, updatedAt: Date.now() } : n)))
    for (const n of toMove) markDirty(`notes/${n.id}.md`)
  }

  // --- 이미지 에셋: 붙여넣기 시 업로드 큐 등록 + 프리뷰용 경로 해석 ---
  const addAsset = (path) => markDirty(path) // 데이터 리포 업로드 큐(다음 동기화에 반영)
  // assets/ 경로 → objectURL. 캐시 → IndexedDB → (동기화 설정 시)데이터 리포 Contents API 순
  const resolveAsset = useCallback(
    async (path) => {
      if (!isAssetPath(path)) return path
      if (assetCache.has(path)) return assetCache.get(path)
      let blob = null
      try {
        blob = await idbGetAsset(path)
      } catch {
        // IndexedDB 접근 불가
      }
      if (!blob && isSyncConfigured(gh)) {
        try {
          const branch = gh.dataBranch?.trim() || 'main'
          const res = await ghFetch(gh.pat, `/repos/${gh.username.trim()}/${gh.dataRepo.trim()}/contents/${path}?ref=${branch}`)
          if (res.ok) {
            const json = await res.json()
            blob = new Blob([base64ToBytes(json.content || '')])
            idbPutAsset(path, blob).catch(() => {})
          }
        } catch {
          // 네트워크 실패 — 아래에서 null 반환(플레이스홀더)
        }
      }
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      assetCache.set(path, url)
      return url
    },
    [gh],
  )

  // --- 그룹 (문제집) ---

  const problemGroups = useMemo(() => [...new Set(problems.map((p) => p.group).filter(Boolean))], [problems])
  const collapsedGroups = uiState.collapsedGroups || []
  const toggleProblemGroup = (key) =>
    setUiState((s) => {
      const cur = s.collapsedGroups || []
      return { ...s, collapsedGroups: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] }
    })

  const renameProblemGroup = (name) => {
    const next = window.prompt('그룹 이름 변경', name)?.trim()
    if (!next || next === name) return
    setProblems((prev) => prev.map((p) => (p.group === name ? { ...p, group: next } : p)))
    markDirty('problems.json')
  }

  const clearProblemGroup = (name) => {
    if (!window.confirm(`"${name}" 그룹을 해제할까요?\n문제는 삭제되지 않고 '그룹 없음'으로 이동합니다.`)) return
    setProblems((prev) => prev.map((p) => (p.group === name ? { ...p, group: '' } : p)))
    markDirty('problems.json')
  }

  // 선택한 문제들을 특정 그룹으로(또는 ''=그룹 없음으로) 이동
  const setProblemsGroup = (ids, group) => {
    const idSet = new Set(ids)
    setProblems((prev) => prev.map((p) => (idSet.has(p.id) ? { ...p, group } : p)))
    markDirty('problems.json')
  }

  // 선택한 문제들로 새 그룹 생성 — 이름은 '새 그룹'(중복 시 '새 그룹 2'…), 나중에 연필로 수정
  const createGroupFromProblems = (ids) => {
    if (!ids.length) return
    const used = new Set(problems.map((p) => p.group).filter(Boolean))
    let name = '새 그룹'
    for (let i = 2; used.has(name); i++) name = `새 그룹 ${i}`
    setProblemsGroup(ids, name)
    addToast('success', `${ids.length}개 문제를 "${name}"으로 묶었습니다.`)
  }

  // 문제 위로 드롭(합치기) — 대상이 그룹에 속하면 그 그룹으로, 아니면 대상+드래그로 새 그룹 생성
  const mergeOntoProblem = (ids, target) => {
    const dragged = ids.filter((id) => id !== target.id)
    if (!dragged.length) return
    if (target.group) setProblemsGroup(dragged, target.group)
    else createGroupFromProblems([target.id, ...dragged])
  }

  const deleteProblems = (ids) => {
    if (!ids.length) return
    if (!window.confirm(`선택한 ${ids.length}개 문제를 삭제할까요?`)) return
    const idSet = new Set(ids)
    setProblems((prev) => prev.filter((p) => !idSet.has(p.id)))
    markDirty('problems.json')
  }

  const deleteProblem = (problem) => {
    if (!window.confirm(`"${problem.name}" 문제를 삭제할까요?`)) return
    setProblems((prev) => prev.filter((p) => p.id !== problem.id))
    markDirty('problems.json')
  }

  // 캡처 바 일괄 등록 — 파싱된 줄들을 To Do로 즉시 추가 (선택된 그룹이 있으면 그 문제집으로)
  const quickAddProblems = (items, group) => {
    const created = items.map((it) => ({
      id: uid(),
      name: it.name,
      url: it.url,
      platform: it.platform,
      difficulty: '',
      tags: [],
      group: group || '',
      status: 'todo',
      createdAt: Date.now(),
      reviewAt: null,
    }))
    setProblems((prev) => [...prev, ...created])
    markDirty('problems.json')
    addToast('success', `문제 ${created.length}개를 추가했습니다.`)
  }

  const createNote = (folderId = null, init = {}) => {
    const note = {
      id: uid(),
      problemId: null,
      title: init.title || '',
      category: '',
      tags: [],
      folderId,
      content: init.content || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      published: false,
      publishedPath: null,
    }
    setNotes((prev) => [note, ...prev])
    markDirty(`notes/${note.id}.md`)
    setUiState((s) => ({ ...s, activeView: 'editor', activeNoteId: note.id }))
  }

  // 새 노트 진입점 — 스니펫이 있으면 템플릿 선택 모달, 없으면 바로 빈 노트.
  // onClick/단축키 콜백에 직접 걸리므로 이벤트 인자가 folderId로 새지 않게 분리한다.
  const requestNewNoteInFolder = (folderId) => (snippets.length ? setNewNoteModal({ folderId }) : createNote(folderId))
  const requestNewNote = () => requestNewNoteInFolder(null)

  const createNoteFromChoice = (snippet) => {
    const { folderId } = newNoteModal
    setNewNoteModal(null)
    if (!snippet) {
      createNote(folderId)
      return
    }
    const title = renderSnippetVars(snippet.title || '').trim()
    const { text } = renderSnippet(snippet.content, { title })
    createNote(folderId, { title, content: text })
  }

  const updateNote = (id, patch) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)))
    markDirty(`notes/${id}.md`)
  }

  const deleteNote = (id) => {
    if (!window.confirm('이 노트를 삭제할까요?')) return
    setNotes((prev) => prev.filter((n) => n.id !== id))
    queueDelete(`notes/${id}.md`)
    setUiState((s) => (s.activeNoteId === id ? { ...s, activeNoteId: null } : s))
  }

  // 세션 노트 생성 — 제목은 사용자 파일 관례(YYMMDD [셋이름]), 본문은 ## A~ + # Upsolving
  const createSessionNote = ({ name, count }) => {
    const d = new Date()
    const compact = `${String(d.getFullYear() % 100).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const sections = Array.from({ length: count }, (_, i) => `## ${String.fromCharCode(65 + i)}\n\n\n`).join('')
    const note = {
      id: uid(),
      problemId: null,
      title: name ? `${compact} ${name}` : compact,
      category: name || '세션',
      tags: [],
      folderId: null,
      content: `${sections}# Upsolving\n\n`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      published: false,
      publishedPath: null,
    }
    setNotes((prev) => [note, ...prev])
    markDirty(`notes/${note.id}.md`)
    setSessionNoteOpen(false)
    setUiState((s) => ({ ...s, activeView: 'editor', activeNoteId: note.id, editorMode: 'edit' }))
  }

  // --- 저지 연동: CF/AtCoder 제출 이력으로 AC 자동 Done + CF 레이팅 자동 채우기 ---
  // (CORS 실측: codeforces.com API·kenkoooo submissions 허용, solved.ac·problems.json 차단)

  const judgeSyncKeyRef = useRef(null)
  const judgeSyncingRef = useRef(false)

  const syncJudges = async ({ silent } = {}) => {
    const cfHandle = gh.cfHandle?.trim()
    const atcoderHandle = gh.atcoderHandle?.trim()
    if (judgeSyncingRef.current) return
    if (!cfHandle && !atcoderHandle) {
      if (!silent) {
        addToast('error', '설정에서 Codeforces/AtCoder 핸들을 먼저 입력해주세요.')
        setSettingsOpen(true)
      }
      return
    }
    judgeSyncingRef.current = true
    try {
      const ac = new Map() // 매칭 키 -> 최초 AC 시각(ms)
      const record = (key, ms) => {
        if (!ac.has(key) || ms < ac.get(key)) ac.set(key, ms)
      }
      if (cfHandle) {
        const res = await fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(cfHandle)}&from=1&count=3000`)
        const data = await res.json()
        if (data.status !== 'OK') throw new Error(`Codeforces: ${data.comment || '조회 실패'}`)
        for (const sub of data.result) {
          if (sub.verdict !== 'OK' || !sub.problem?.contestId) continue
          record(`cf:${sub.problem.contestId}${(sub.problem.index || '').toUpperCase()}`, (sub.creationTimeSeconds || 0) * 1000)
        }
      }
      if (atcoderHandle) {
        // kenkoooo v3는 from_second부터 최대 500건 — 끝날 때까지 페이지네이션 (상한 10회)
        let from = 0
        for (let i = 0; i < 10; i++) {
          const res = await fetch(
            `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(atcoderHandle)}&from_second=${from}`,
          )
          if (!res.ok) throw new Error(`AtCoder(kenkoooo): HTTP ${res.status}`)
          const subs = await res.json()
          if (!Array.isArray(subs) || subs.length === 0) break
          for (const sub of subs) {
            if (sub.result === 'AC') record(`ac:${sub.problem_id}`, (sub.epoch_second || 0) * 1000)
          }
          if (subs.length < 500) break
          from = subs[subs.length - 1].epoch_second + 1
        }
      }

      // AC된 문제를 조용히 Done 처리 (복습 모달·노트 자동 생성 없음 — 일괄 반영이라 모달 연쇄 방지)
      const updates = new Map() // id -> AC 시각
      for (const p of problems) {
        const key = judgeKeyFromUrl(p.url)
        if (key && ac.has(key) && p.status !== 'done') updates.set(p.id, ac.get(key))
      }
      if (updates.size) {
        setProblems((prev) =>
          prev.map((p) => (updates.has(p.id) ? { ...p, status: 'done', solvedAt: p.solvedAt ?? updates.get(p.id) } : p)),
        )
        markDirty('problems.json')
        addToast('success', `저지 동기화: AC 확인된 ${updates.size}문제를 Done 처리했습니다.`)
      } else if (!silent) {
        addToast('success', '저지 동기화: 새로 확인된 AC가 없습니다.')
      }
    } catch (err) {
      if (!silent) addToast('error', `저지 동기화 실패: ${err.message}`)
    } finally {
      judgeSyncingRef.current = false
    }
  }

  // 시작 시(핸들 조합이 바뀌었을 때만) 1회 자동 실행
  useEffect(() => {
    const key = [gh.cfHandle, gh.atcoderHandle].join('\0')
    if (!gh.cfHandle?.trim() && !gh.atcoderHandle?.trim()) {
      judgeSyncKeyRef.current = null
      return
    }
    if (judgeSyncKeyRef.current === key) return
    judgeSyncKeyRef.current = key
    syncJudges({ silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gh.cfHandle, gh.atcoderHandle])

  // 난이도가 빈 CF 문제는 problemset.problems(세션당 1회 캐시)로 레이팅 자동 채우기 — 핸들 불필요
  const cfRatingsRef = useRef(null)
  const cfEnrichTriedRef = useRef(new Set())
  useEffect(() => {
    const targets = problems.filter(
      (p) => !p.difficulty && !cfEnrichTriedRef.current.has(p.id) && judgeKeyFromUrl(p.url)?.startsWith('cf:'),
    )
    if (!targets.length) return
    for (const p of targets) cfEnrichTriedRef.current.add(p.id)
    ;(async () => {
      try {
        if (!cfRatingsRef.current) {
          const res = await fetch('https://codeforces.com/api/problemset.problems')
          const data = await res.json()
          if (data.status !== 'OK') return
          cfRatingsRef.current = new Map(
            data.result.problems.filter((pr) => pr.rating).map((pr) => [`cf:${pr.contestId}${pr.index}`, String(pr.rating)]),
          )
        }
        const fill = new Map()
        for (const p of targets) {
          const rating = cfRatingsRef.current.get(judgeKeyFromUrl(p.url))
          if (rating) fill.set(p.id, rating)
        }
        if (fill.size) {
          setProblems((prev) => prev.map((p) => (fill.has(p.id) ? { ...p, difficulty: fill.get(p.id) } : p)))
          markDirty('problems.json')
        }
      } catch {
        // 네트워크 실패는 조용히 무시 — 다음 문제 추가 때 재시도 대상엔 이미 tried 마킹돼 있어 스팸 없음
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problems])

  // 프리뷰의 [[위키링크]] 클릭 — 제목 일치 노트 열기, 없으면 옵시디언처럼 새로 생성
  const openWikiLink = (title) => {
    const target = notes.find((n) => (n.title || '').trim() === title.trim())
    if (target) {
      setUiState((s) => ({ ...s, activeView: 'editor', activeNoteId: target.id }))
      return
    }
    const note = {
      id: uid(),
      problemId: null,
      title: title.trim(),
      category: '',
      tags: [],
      folderId: null,
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      published: false,
      publishedPath: null,
    }
    setNotes((prev) => [note, ...prev])
    markDirty(`notes/${note.id}.md`)
    setUiState((s) => ({ ...s, activeView: 'editor', activeNoteId: note.id }))
    addToast('success', `"${note.title}" 노트를 새로 만들었습니다.`)
  }

  const createSnippet = () => {
    const snippet = { id: uid(), name: '새 스니펫', content: '', createdAt: Date.now(), updatedAt: Date.now() }
    setSnippets((prev) => [...prev, snippet])
    markDirty(`snippets/${snippet.id}.md`)
    return snippet.id
  }

  const updateSnippet = (id, patch) => {
    setSnippets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)))
    markDirty(`snippets/${id}.md`)
  }

  const deleteSnippet = (id) => {
    const snippet = snippets.find((s) => s.id === id)
    if (!window.confirm(`"${snippet?.name || '이름 없음'}" 스니펫을 삭제할까요?`)) return false
    setSnippets((prev) => prev.filter((s) => s.id !== id))
    queueDelete(`snippets/${id}.md`)
    return true
  }

  // .md 가져오기: front matter가 있으면 id 기준 upsert(내보내기 후 재가져오기 = 갱신),
  // 없으면 파일명을 이름으로 새 스니펫 생성
  const importSnippetFiles = async (fileList) => {
    const imported = []
    for (const file of [...fileList]) {
      try {
        const text = await file.text()
        const parsed = markdownToSnippet(text)
        imported.push(
          parsed ?? { id: uid(), name: file.name.replace(/\.md$/i, ''), content: text, createdAt: Date.now(), updatedAt: Date.now() },
        )
      } catch {
        // 읽기 실패한 파일은 건너뜀
      }
    }
    if (!imported.length) {
      addToast('error', '가져올 수 있는 .md 파일이 없습니다.')
      return []
    }
    setSnippets((prev) => {
      const next = [...prev]
      for (const snip of imported) {
        const idx = next.findIndex((s) => s.id === snip.id)
        if (idx === -1) next.push(snip)
        else next[idx] = snip
      }
      return next
    })
    for (const snip of imported) markDirty(`snippets/${snip.id}.md`)
    addToast('success', `스니펫 ${imported.length}개를 가져왔습니다.`)
    return imported.map((s) => s.id)
  }

  const exportSnippet = (snippet) => {
    const blob = new Blob([snippetToMarkdown(snippet)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(snippet.name) || snippet.id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Ctrl+K 퀵 스위처 + 전역 단축키 ---

  const toggleEditorMode = () =>
    setUiState((s) => ({ ...s, activeView: 'editor', editorMode: s.editorMode === 'preview' ? 'edit' : 'preview' }))
  const handleSyncShortcut = () => (syncStatus === 'off' ? setSettingsOpen(true) : syncNow())
  const anyModalOpen =
    settingsOpen || snippetsOpen || problemModal !== null || reviewModal !== null || sessionNoteOpen || folderModal !== null || newNoteModal !== null

  // capture 리스너라 CodeMirror 키맵보다 먼저 돈다 — 여기서 다루는 키 외(Ctrl+F 등)는 건드리지 않을 것
  const shortcutRef = useRef(null)
  shortcutRef.current = { anyModalOpen, switcherOpen, toggleEditorMode, requestNewNote, handleSyncShortcut }
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const ctx = shortcutRef.current
      // Ctrl+S: 모달 열림 여부와 무관하게 브라우저 저장 다이얼로그는 항상 막는다
      if (e.code === 'KeyS' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        if (!ctx.anyModalOpen && !ctx.switcherOpen) ctx.handleSyncShortcut()
        return
      }
      if (ctx.anyModalOpen) return // 모달 위에서는 단축키 무시 (Esc만 동작)
      if (e.code === 'KeyK' && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        setSwitcherOpen((o) => !o)
      } else if (e.code === 'KeyE' && !e.altKey && !e.shiftKey && !ctx.switcherOpen) {
        e.preventDefault()
        e.stopPropagation()
        ctx.toggleEditorMode()
      } else if (e.code === 'KeyN' && e.altKey && !e.shiftKey && !ctx.switcherOpen) {
        // Ctrl+N은 브라우저 예약키라 가로챌 수 없어 Ctrl+Alt+N 사용
        e.preventDefault()
        e.stopPropagation()
        ctx.requestNewNote()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const switcherCommands = [
    { id: 'new-note', icon: Plus, label: '새 노트 만들기', hint: 'Ctrl+Alt+N', run: requestNewNote },
    { id: 'new-folder', icon: FolderPlus, label: '새 폴더 만들기', run: () => setFolderModal({ parentId: null }) },
    { id: 'session-note', icon: CalendarPlus, label: '오늘 세션 노트 만들기', run: () => setSessionNoteOpen(true) },
    { id: 'judge-sync', icon: Trophy, label: '저지 동기화 (AC 자동 반영)', run: () => syncJudges() },
    {
      id: 'toggle-mode',
      icon: uiState.editorMode === 'preview' ? Pencil : Eye,
      label: uiState.editorMode === 'preview' ? '편집 모드로 전환' : '미리보기 모드로 전환',
      hint: 'Ctrl+E',
      run: toggleEditorMode,
    },
    { id: 'sync', icon: RefreshCw, label: '지금 동기화', hint: 'Ctrl+S', run: handleSyncShortcut },
    { id: 'theme', icon: theme === 'dark' ? Sun : Moon, label: theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환', run: toggleTheme },
    { id: 'settings', icon: Settings, label: '설정 열기', run: () => setSettingsOpen(true) },
    { id: 'go-board', icon: LayoutGrid, label: '풀 문제 보드로 이동', run: () => navigate('board') },
    { id: 'go-editor', icon: FileText, label: '에디터로 이동', run: () => navigate('editor') },
    { id: 'go-stats', icon: ChartColumn, label: '통계로 이동', run: () => navigate('stats') },
  ]

  const handleSaveSettings = (settings) => {
    setGithubSettings(settings)
    setSettingsOpen(false)
    addToast('success', 'GitHub 설정이 저장되었습니다.')
  }

  const publishNote = async (note) => {
    const { username, repo, branch, pat } = gh
    if (!username.trim() || !repo.trim() || !pat.trim()) {
      addToast('error', 'GitHub 사용자명 / 저장소 / 토큰을 설정에서 먼저 입력해주세요.')
      setSettingsOpen(true)
      return
    }

    setPublishing(true)
    const branchName = branch.trim() || 'main'
    const path = `_posts/${formatDate(new Date())}-${slugify(note.title)}.md`
    const basePath = `/repos/${username.trim()}/${repo.trim()}/contents/${path}`
    // 블로그에는 [[위키링크]]가 렌더되지 않으므로 제목 텍스트로 변환해 발행
    const body = buildFrontMatter(note) + note.content.replace(/\[\[([^\][\n]+?)\]\]/g, '$1')

    const doPut = (shaToUse) =>
      ghFetch(pat, basePath, {
        method: 'PUT',
        body: JSON.stringify({
          message: `post: ${note.title || 'untitled'}`,
          content: toBase64(body),
          branch: branchName,
          ...(shaToUse ? { sha: shaToUse } : {}),
        }),
      })

    try {
      let sha
      const getRes = await ghFetch(pat, `${basePath}?ref=${branchName}`)
      if (getRes.status === 200) {
        sha = (await getRes.json()).sha
      } else if (getRes.status !== 404) {
        throw new Error((await safeJson(getRes))?.message || `기존 파일 확인 실패 (${getRes.status})`)
      }

      let putRes = await doPut(sha)
      if (putRes.status === 409) {
        const retryGet = await ghFetch(pat, `${basePath}?ref=${branchName}`)
        if (retryGet.status !== 200) throw new Error('충돌 해결을 위한 파일 재조회에 실패했습니다.')
        putRes = await doPut((await retryGet.json()).sha)
      }
      if (!putRes.ok) throw new Error((await safeJson(putRes))?.message || `발행 실패 (${putRes.status})`)

      updateNote(note.id, { published: true, publishedPath: path })
      addToast('success', `"${note.title || 'untitled'}" 발행 완료 → ${path}`)
    } catch (err) {
      addToast('error', err.message || '발행 중 오류가 발생했습니다.')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg font-sans text-ink">
      <Sidebar
        activeView={uiState.activeView}
        onNavigate={navigate}
        onOpenSettings={() => setSettingsOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        collapsed={uiState.sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
        notes={notes}
        folders={folders}
        collapsedFolders={collapsedFolders}
        folderActions={{
          onToggleFolder: toggleFolder,
          onMoveNotes: moveNotesToFolder,
          onNewNoteInFolder: requestNewNoteInFolder,
          onEditFolder: setFolderModal,
          onDeleteFolder: deleteFolder,
        }}
        activeNoteId={uiState.activeNoteId}
        onSelectNote={(id) => setUiState((s) => ({ ...s, activeNoteId: id }))}
        onNewNote={requestNewNote}
        onNewFolder={() => setFolderModal({ parentId: null })}
        onDeleteNote={deleteNote}
        syncStatus={syncStatus}
        lastSyncAt={lastSyncAt}
        onSyncClick={() => (syncStatus === 'off' ? setSettingsOpen(true) : syncNow())}
        reviewDueCount={reviewDueCount}
      />

      <main className="flex-1 overflow-hidden">
        {uiState.activeView === 'stats' ? (
          <StatsView problems={problems} notes={notes} />
        ) : uiState.activeView === 'board' ? (
          <ProblemBoard
            problems={problems}
            groups={problemGroups}
            onAddClick={() => setProblemModal({})}
            onQuickAdd={quickAddProblems}
            onEdit={(p) => setProblemModal(p)}
            onDelete={deleteProblem}
            onStatusChange={changeProblemStatus}
            onReviewRetry={retryReviewProblem}
            onReviewComplete={completeReviewProblem}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleProblemGroup}
            onRenameGroup={renameProblemGroup}
            onClearGroup={clearProblemGroup}
            onGroupProblems={createGroupFromProblems}
            onSetProblemsGroup={setProblemsGroup}
            onMergeOntoProblem={mergeOntoProblem}
            onDeleteProblems={deleteProblems}
          />
        ) : (
          <EditorView
            activeNote={activeNote}
            onNewNote={requestNewNote}
            onUpdateNote={updateNote}
            onPublish={publishNote}
            publishing={publishing}
            editorMode={uiState.editorMode}
            onSetEditorMode={setEditorMode}
            snippets={snippets}
            onManageSnippets={() => setSnippetsOpen(true)}
            notes={notes}
            problems={problems}
            onOpenWikiLink={openWikiLink}
            onSelectNote={(id) => setUiState((s) => ({ ...s, activeNoteId: id }))}
            onToast={addToast}
            onAddAsset={addAsset}
            resolveAsset={resolveAsset}
          />
        )}
      </main>

      {switcherOpen && (
        <QuickSwitcher
          notes={notes}
          folders={folders}
          problems={problems}
          commands={switcherCommands}
          onClose={() => setSwitcherOpen(false)}
          onOpenNote={(id) => setUiState((s) => ({ ...s, activeView: 'editor', activeNoteId: id }))}
          onOpenProblem={(p) => {
            navigate('board')
            setProblemModal(p)
          }}
        />
      )}
      {problemModal !== null && (
        <ProblemModal
          initial={problemModal.id ? problemModal : null}
          groups={problemGroups}
          onClose={() => setProblemModal(null)}
          onSave={upsertProblem}
        />
      )}
      {folderModal !== null && <FolderModal initial={folderModal} folders={folders} onClose={() => setFolderModal(null)} onSave={upsertFolder} />}
      {newNoteModal !== null && <NewNoteModal snippets={snippets} onClose={() => setNewNoteModal(null)} onCreate={createNoteFromChoice} />}
      {reviewModal !== null && <ReviewModal problem={reviewModal} onSelect={applyReviewChoice} onClose={() => applyReviewChoice(null)} />}
      {sessionNoteOpen && <SessionNoteModal onClose={() => setSessionNoteOpen(false)} onCreate={createSessionNote} />}
      {snippetsOpen && (
        <SnippetsModal
          snippets={snippets}
          onClose={() => setSnippetsOpen(false)}
          onCreate={createSnippet}
          onUpdate={updateSnippet}
          onDelete={deleteSnippet}
          onImport={importSnippetFiles}
          onExport={exportSnippet}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={gh}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
          onCreateRepo={async (form) => {
            const result = await createDataRepo(form)
            addToast(result.ok ? 'success' : 'error', result.message)
            return result.ok
          }}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
