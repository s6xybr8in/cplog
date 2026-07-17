import { useState, useMemo } from 'react'
import { X } from 'lucide-react'
import { FOLDER_EMOJI_PRESETS, FOLDER_COLORS } from '../../constants'
import { cn, uid } from '../../lib/utils'
import { ModalShell } from '../ui/ModalShell'
import { Field } from '../ui/Field'

// 폴더 생성/편집 모달 — initial이 id를 가지면 편집, {parentId}면 해당 위치에 새 폴더
function FolderModal({ initial, folders, onClose, onSave }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => (isEdit ? { ...initial } : { name: '', emoji: '', color: '', parentId: initial?.parentId ?? null }))

  // 자기 자신과 자손은 상위 폴더 후보에서 제외 (순환 방지)
  const descendants = useMemo(() => {
    if (!isEdit) return new Set()
    const set = new Set([initial.id])
    let grew = true
    while (grew) {
      grew = false
      for (const f of folders) {
        if (f.parentId && set.has(f.parentId) && !set.has(f.id)) {
          set.add(f.id)
          grew = true
        }
      }
    }
    return set
  }, [isEdit, initial, folders])

  // 상위 폴더 셀렉트 라벨은 전체 경로("부모 / 자식")로 표시
  const pathById = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    const pathOf = (f) => {
      const parts = [f.name]
      const seen = new Set([f.id])
      let cur = f
      while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
        cur = byId.get(cur.parentId)
        seen.add(cur.id)
        parts.unshift(cur.name)
      }
      return parts.join(' / ')
    }
    return new Map(folders.map((f) => [f.id, pathOf(f)]))
  }, [folders])

  const parentOptions = folders
    .filter((f) => !descendants.has(f.id))
    .sort((a, b) => (pathById.get(a.id) || '').localeCompare(pathById.get(b.id) || '', 'ko'))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({
      ...form,
      name: form.name.trim(),
      emoji: (form.emoji || '').trim(),
      parentId: form.parentId || null,
      id: initial?.id ?? uid(),
      createdAt: initial?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? '폴더 편집' : '새 폴더'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="폴더 이름" required>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="cp-input"
            placeholder="예: 대회 기록"
          />
        </Field>
        <Field label="이모지">
          <div className="flex items-center gap-2">
            <input
              value={form.emoji || ''}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              maxLength={4}
              className="cp-input w-16 text-center"
              placeholder="—"
            />
            <div className="flex flex-wrap gap-1">
              {FOLDER_EMOJI_PRESETS.map((em) => (
                <button
                  type="button"
                  key={em}
                  onClick={() => setForm((f) => ({ ...f, emoji: f.emoji === em ? '' : em }))}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg border text-[14px]',
                    form.emoji === em ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-alt',
                  )}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="색상">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: '' }))}
              title="색상 없음"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border',
                !form.color ? 'border-accent bg-accent-soft' : 'border-border hover:bg-surface-alt',
              )}
            >
              <X size={11} className="text-ink-faint" />
            </button>
            {Object.entries(FOLDER_COLORS).map(([key, hex]) => (
              <button
                type="button"
                key={key}
                title={key}
                onClick={() => setForm((f) => ({ ...f, color: key }))}
                className={cn('h-6 w-6 rounded-full border-2 transition-transform', form.color === key ? 'scale-110 border-ink' : 'border-transparent')}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </Field>
        <Field label="상위 폴더">
          <select
            value={form.parentId || ''}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
            className="cp-input"
          >
            <option value="">(루트)</option>
            {parentOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {pathById.get(f.id)}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            {isEdit ? '저장' : '만들기'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export { FolderModal }
