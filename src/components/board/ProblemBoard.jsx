import { useState } from 'react'
import { Plus, Zap, CalendarClock, RotateCcw, Check } from 'lucide-react'
import { DAY_MS } from '../../constants'
import { cn } from '../../lib/utils'
import { parseProblemLine } from '../../lib/problems'
import { ProblemTable } from './ProblemTable'

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

export { ProblemBoard }
