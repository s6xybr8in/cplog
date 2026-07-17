import { useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { ModalShell } from '../ui/ModalShell'
import { Field } from '../ui/Field'

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

export { SessionNoteModal }
