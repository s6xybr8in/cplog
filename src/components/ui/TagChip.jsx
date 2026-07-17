import { X } from 'lucide-react'

function TagChip({ children, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2 py-0.5 text-[11px] font-medium text-ink-muted">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} className="opacity-50 hover:opacity-100">
          <X size={10} />
        </button>
      )}
    </span>
  )
}

export { TagChip }
