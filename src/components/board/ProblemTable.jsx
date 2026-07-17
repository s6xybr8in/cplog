import { useState, useEffect, useRef } from 'react'
import { X, FolderPlus, Trash2, ExternalLink, Pencil, ChevronRight } from 'lucide-react'
import { COLUMNS, STATUS_ORDER, PLATFORM_BADGE } from '../../constants'
import { cn } from '../../lib/utils'
import { TagChip } from '../ui/TagChip'
import { DifficultyBadge } from '../ui/DifficultyBadge'

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

  // 그룹(문제집)별 섹션 — 항상 그룹 이름순, '그룹 없음'은 맨 뒤.
  // 그룹이 하나도 없으면 섹션 헤더 없이 기존 단일 표 그대로.
  const byGroup = new Map()
  for (const p of problems) {
    const g = p.group || ''
    if (!byGroup.has(g)) byGroup.set(g, [])
    byGroup.get(g).push(p)
  }
  const named = [...byGroup.entries()]
    .filter(([g]) => g)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
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

export { ProblemTable }
