import { X } from 'lucide-react'
import { TOAST_STYLE } from '../../constants'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Small shared UI pieces
// ---------------------------------------------------------------------------

function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const meta = TOAST_STYLE[t.type] || TOAST_STYLE.success
        const Icon = meta.icon
        return (
          <div key={t.id} className={cn('pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg', meta.cls)}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1 text-[13px] leading-snug">{t.message}</p>
            <button onClick={() => onDismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export { ToastStack }
