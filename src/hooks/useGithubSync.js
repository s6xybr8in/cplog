import { useState, useEffect, useRef, useCallback } from 'react'
import { LS_KEYS } from '../constants'
import { uid } from '../lib/utils'
import { ghFetch, safeJson, toBase64, fromBase64 } from '../lib/github'
import { isAssetPath, idbGetAsset, blobToBase64 } from '../lib/assets'
import { noteToMarkdown, markdownToNote, snippetToMarkdown, markdownToSnippet } from '../lib/markdown'
import { useLocalStorageState } from './useLocalStorageState'

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

export { isSyncConfigured, useGithubSync }
