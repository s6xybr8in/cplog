import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, FileText, LayoutGrid } from 'lucide-react'
import { cn } from '../lib/utils'

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

export { QuickSwitcher }
