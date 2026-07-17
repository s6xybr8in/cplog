import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={cn('max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-alt hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export { ModalShell }
