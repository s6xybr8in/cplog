import { useState, useRef } from 'react'
import { Plus, Upload, Trash2, Download, Braces } from 'lucide-react'
import { cn, formatDateTime } from '../../lib/utils'
import { ModalShell } from '../ui/ModalShell'
import { Field } from '../ui/Field'

// ---------------------------------------------------------------------------
// Snippets manager
// ---------------------------------------------------------------------------

function SnippetsModal({ snippets, onClose, onCreate, onUpdate, onDelete, onImport, onExport }) {
  const [selectedId, setSelectedId] = useState(snippets[0]?.id ?? null)
  const selected = snippets.find((s) => s.id === selectedId) || null
  const fileRef = useRef(null)

  const handleCreate = () => setSelectedId(onCreate())

  const handleDelete = () => {
    if (!selected || !onDelete(selected.id)) return
    setSelectedId(snippets.find((s) => s.id !== selected.id)?.id ?? null)
  }

  const handleImport = async (e) => {
    const ids = await onImport(e.target.files)
    if (ids.length) setSelectedId(ids[ids.length - 1])
    e.target.value = ''
  }

  return (
    <ModalShell title="스니펫 관리" onClose={onClose} wide>
      <div className="grid grid-cols-[13rem_1fr] gap-5">
        <div className="flex max-h-[60vh] min-h-[20rem] flex-col rounded-xl border border-border">
          <div className="flex-1 overflow-y-auto p-1.5">
            {snippets.length === 0 && <p className="px-2 py-4 text-center text-[11px] text-ink-faint">스니펫이 없습니다</p>}
            {snippets.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  'mb-0.5 w-full rounded-lg px-2.5 py-2 text-left',
                  s.id === selectedId ? 'bg-accent-soft' : 'hover:bg-surface-alt',
                )}
              >
                <p className={cn('truncate text-[13px] font-semibold', s.id === selectedId ? 'text-accent-strong' : 'text-ink')}>
                  {s.name || '이름 없음'}
                </p>
                <p className="mt-0.5 text-[10.5px] text-ink-faint">{formatDateTime(s.updatedAt)}</p>
              </button>
            ))}
          </div>
          <div className="flex gap-1 border-t border-border p-1.5">
            <button onClick={handleCreate} className="cp-btn-ghost flex-1 justify-center text-xs">
              <Plus size={13} /> 새로 만들기
            </button>
            <button onClick={() => fileRef.current?.click()} title=".md 파일 가져오기" className="cp-btn-ghost text-xs">
              <Upload size={13} />
            </button>
            <input ref={fileRef} type="file" accept=".md" multiple onChange={handleImport} className="hidden" />
          </div>
        </div>

        {selected ? (
          <div className="flex flex-col gap-3">
            <Field label="이름">
              <input value={selected.name} onChange={(e) => onUpdate(selected.id, { name: e.target.value })} className="cp-input" />
            </Field>
            <Field label="제목 템플릿">
              <input
                value={selected.title || ''}
                onChange={(e) => onUpdate(selected.id, { title: e.target.value })}
                className="cp-input"
                placeholder="예: {{date}} 오답노트 — 비우면 제목 미설정"
              />
            </Field>
            <Field label="내용">
              <textarea
                value={selected.content}
                onChange={(e) => onUpdate(selected.id, { content: e.target.value })}
                spellCheck={false}
                className="cp-input h-64 resize-none font-mono text-[12.5px] leading-relaxed"
              />
            </Field>
            <p className="text-[11px] leading-relaxed text-ink-faint">
              사용 가능한 변수: {'{{date}}'} {'{{time}}'} {'{{datetime}}'} {'{{title}}'} {'{{cursor}}'} — 삽입 시 치환되며, {'{{cursor}}'}{' '}
              위치로 커서가 이동합니다. 제목 템플릿({'{{date}}'}/{'{{time}}'}/{'{{datetime}}'} 사용 가능)은 이 스니펫으로 새 노트를 만들거나
              제목 없는 노트에 삽입할 때 노트 제목이 됩니다.
            </p>
            <div className="flex justify-between">
              <button onClick={handleDelete} className="cp-btn-ghost text-danger hover:bg-danger-soft">
                <Trash2 size={14} /> 삭제
              </button>
              <button onClick={() => onExport(selected)} className="cp-btn-ghost">
                <Download size={14} /> .md 내보내기
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <Braces size={26} className="text-ink-faint" />
            <p className="text-xs text-ink-muted">
              왼쪽에서 스니펫을 선택하거나
              <br />새 스니펫을 만들어보세요.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  )
}

export { SnippetsModal }
