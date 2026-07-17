import { useMemo } from 'react'
import { cn, formatDate } from '../../lib/utils'

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

export { StatsView }
