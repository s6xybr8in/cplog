import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  LayoutGrid, FileText, Settings, Plus, Pencil, Eye, Sun, Moon, RefreshCw, Trophy, CalendarPlus, ChartColumn, FolderPlus,
} from 'lucide-react'
import { LS_KEYS, DAY_MS, DEFAULT_GITHUB_SETTINGS } from './constants'
import { uid, formatDate, slugify } from './lib/utils'
import { judgeKeyFromUrl } from './lib/problems'
import { DEFAULT_SNIPPETS, renderSnippetVars, renderSnippet } from './lib/snippets'
import { buildFrontMatter, markdownToSnippet, snippetToMarkdown } from './lib/markdown'
import { ghFetch, safeJson, toBase64 } from './lib/github'
import { isAssetPath, assetCache, idbGetAsset, idbPutAsset, blobToBase64, base64ToBytes } from './lib/assets'
import { useLocalStorageState } from './hooks/useLocalStorageState'
import { isSyncConfigured, useGithubSync } from './hooks/useGithubSync'
import { ToastStack } from './components/ui/ToastStack'
import { Sidebar } from './components/sidebar/Sidebar'
import { ProblemBoard } from './components/board/ProblemBoard'
import { EditorView } from './components/editor/EditorView'
import { StatsView } from './components/stats/StatsView'
import { QuickSwitcher } from './components/QuickSwitcher'
import { ProblemModal } from './components/modals/ProblemModal'
import { ReviewModal } from './components/modals/ReviewModal'
import { FolderModal } from './components/modals/FolderModal'
import { NewNoteModal } from './components/modals/NewNoteModal'
import { SettingsModal } from './components/modals/SettingsModal'
import { SnippetsModal } from './components/modals/SnippetsModal'
import { SessionNoteModal } from './components/modals/SessionNoteModal'

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
  // 에셋 blob 로드 — IndexedDB → (동기화 설정 시)데이터 리포 Contents API. 프리뷰·발행 공용.
  const loadAssetBlob = useCallback(
    async (path) => {
      try {
        const b = await idbGetAsset(path)
        if (b) return b
      } catch {
        // IndexedDB 접근 불가
      }
      if (!isSyncConfigured(gh)) return null
      try {
        const branch = gh.dataBranch?.trim() || 'main'
        const res = await ghFetch(gh.pat, `/repos/${gh.username.trim()}/${gh.dataRepo.trim()}/contents/${path}?ref=${branch}`)
        if (res.ok) {
          const blob = new Blob([base64ToBytes((await res.json()).content || '')])
          idbPutAsset(path, blob).catch(() => {})
          return blob
        }
      } catch {
        // 네트워크 실패
      }
      return null
    },
    [gh],
  )
  // assets/ 경로 → objectURL. 캐시 → loadAssetBlob 순
  const resolveAsset = useCallback(
    async (path) => {
      if (!isAssetPath(path)) return path
      if (assetCache.has(path)) return assetCache.get(path)
      const blob = await loadAssetBlob(path)
      if (!blob) return null
      const url = URL.createObjectURL(blob)
      assetCache.set(path, url)
      return url
    },
    [loadAssetBlob],
  )

  // --- 그룹 (문제집) ---

  const problemGroups = useMemo(
    () => [...new Set(problems.map((p) => p.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [problems],
  )
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

    // 블로그(공개 리포)로 발행 시, 노트가 참조하는 assets/ 이미지는 데이터 리포(private)에만 있어
    // 그대로면 깨진다. → 이미지를 공개 블로그 리포 assets/로 업로드하고 마크다운을 절대 raw URL로 치환.
    let content = note.content
    let imageCount = 0
    try {
      const assetPaths = [...new Set([...content.matchAll(/!\[[^\]]*\]\((assets\/[^)\s]+)\)/g)].map((m) => m[1]))]
      for (const aPath of assetPaths) {
        const blob = await loadAssetBlob(aPath)
        if (!blob) continue // 로컬·데이터리포 어디에도 없으면 스킵(그대로 두면 깨지지만 드묾)
        const b64 = await blobToBase64(blob)
        const aBase = `/repos/${username.trim()}/${repo.trim()}/contents/${aPath}`
        const putAsset = (sha) =>
          ghFetch(pat, aBase, {
            method: 'PUT',
            body: JSON.stringify({ message: `post asset: ${aPath}`, content: b64, branch: branchName, ...(sha ? { sha } : {}) }),
          })
        // 이미 있으면 sha로 덮어씀(내용 동일하면 GitHub이 그대로 둠)
        const ex = await ghFetch(pat, `${aBase}?ref=${branchName}`)
        let ares = await putAsset(ex.status === 200 ? (await ex.json()).sha : undefined)
        if (ares.status === 409 || ares.status === 422) {
          const rg = await ghFetch(pat, `${aBase}?ref=${branchName}`)
          if (rg.ok) ares = await putAsset((await rg.json()).sha)
        }
        if (!ares.ok) continue
        const rawUrl = `https://raw.githubusercontent.com/${username.trim()}/${repo.trim()}/${branchName}/${aPath}`
        content = content.split(`](${aPath})`).join(`](${rawUrl})`)
        imageCount += 1
      }
    } catch {
      // 이미지 처리 실패는 발행 자체를 막지 않음 — 남은 assets/ 링크는 깨진 채로 발행될 수 있음
    }

    // 블로그에는 [[위키링크]]가 렌더되지 않으므로 제목 텍스트로 변환해 발행
    const body = buildFrontMatter(note) + content.replace(/\[\[([^\][\n]+?)\]\]/g, '$1')

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
      addToast('success', `"${note.title || 'untitled'}" 발행 완료 → ${path}${imageCount ? ` (이미지 ${imageCount}개 포함)` : ''}`)
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
