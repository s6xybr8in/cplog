import { useMemo } from 'react'
import { Link2 } from 'lucide-react'

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

export { BacklinksBar }
