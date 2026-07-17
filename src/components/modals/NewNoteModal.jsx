import { useState, useEffect, useRef } from 'react'
import { FileText, Braces } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ModalShell } from '../ui/ModalShell'

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

export { NewNoteModal }
