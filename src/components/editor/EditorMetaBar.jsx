import { useState, useEffect, useRef } from 'react'
import { Braces, Settings, Pencil, Eye, Loader2, Rocket, CheckCircle2, Clock } from 'lucide-react'
import { cn, formatDate, formatDateTime } from '../../lib/utils'
import { TagChip } from '../ui/TagChip'

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

export { EditorMetaBar }
