import { REVIEW_OPTIONS } from '../../constants'
import { cn } from '../../lib/utils'
import { ModalShell } from '../ui/ModalShell'

// 문제가 Done으로 전환된 직후 복습 주기를 고르는 모달 (닫기 = "안 함")
function ReviewModal({ problem, onSelect, onClose }) {
  return (
    <ModalShell title="복습 예약" onClose={onClose}>
      <p className="text-sm leading-relaxed text-ink">
        <span className="font-bold">"{problem.name}"</span> 문제를 해결했습니다. 언제 다시 풀어볼까요?
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">기한이 되면 To Solve 보드 상단의 복습 큐에서 알려드립니다.</p>
      <div className="mt-5 grid grid-cols-4 gap-2">
        {REVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.days)}
            className={cn(
              'rounded-lg border py-2.5 text-[13px] font-semibold transition-colors',
              opt.days == null
                ? 'border-border text-ink-faint hover:bg-surface-alt hover:text-ink'
                : 'border-border text-ink hover:border-accent hover:bg-accent-soft hover:text-accent-strong',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </ModalShell>
  )
}

export { ReviewModal }
