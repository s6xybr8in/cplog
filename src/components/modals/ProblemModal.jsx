import { useState } from 'react'
import { PLATFORMS, TAG_SUGGESTIONS, COLUMNS } from '../../constants'
import { uid } from '../../lib/utils'
import { ModalShell } from '../ui/ModalShell'
import { Field } from '../ui/Field'
import { TagChip } from '../ui/TagChip'

function ProblemModal({ initial, groups, onClose, onSave }) {
  const isEdit = !!initial
  const [form, setForm] = useState(
    () =>
      initial ?? {
        name: '',
        url: '',
        platform: PLATFORMS[0],
        difficulty: '',
        tags: [],
        group: '',
        status: 'todo',
        reviewAt: null,
      },
  )
  const [tagDraft, setTagDraft] = useState('')

  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !form.tags.includes(t)) setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    setTagDraft('')
  }
  const removeTag = (t) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave({ ...form, group: (form.group || '').trim(), id: initial?.id ?? uid(), createdAt: initial?.createdAt ?? Date.now() })
  }

  return (
    <ModalShell onClose={onClose} title={isEdit ? '문제 수정' : '문제 추가'}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="문제 이름" required>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="cp-input"
            placeholder="예: Two Pointers 연습"
          />
        </Field>
        <Field label="문제 링크">
          <input
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            className="cp-input"
            placeholder="https://codeforces.com/problemset/problem/..."
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="플랫폼">
            <select value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))} className="cp-input">
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="난이도">
            <input
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              className="cp-input"
              placeholder="예: 1900"
            />
          </Field>
        </div>
        <Field label="그룹 (문제집)">
          <input
            value={form.group || ''}
            onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            list="cp-group-datalist"
            className="cp-input"
            placeholder="예: BOJ 단계별, ABC 412 (비우면 그룹 없음)"
          />
          <datalist id="cp-group-datalist">
            {(groups || []).map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label="태그">
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2">
            {form.tags.map((t) => (
              <TagChip key={t} onRemove={() => removeTag(t)}>
                {t}
              </TagChip>
            ))}
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ',') && tagDraft.trim()) {
                  e.preventDefault()
                  addTag()
                }
                if (e.key === 'Backspace' && !tagDraft && form.tags.length) removeTag(form.tags[form.tags.length - 1])
              }}
              onBlur={addTag}
              placeholder={form.tags.length ? '' : '예: dp, greedy, 수론 (Enter로 추가)'}
              className="min-w-[8rem] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {TAG_SUGGESTIONS.filter((s) => !form.tags.includes(s))
              .slice(0, 6)
              .map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setForm((f) => ({ ...f, tags: [...f.tags, s] }))}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-ink-faint hover:border-accent hover:text-accent"
                >
                  + {s}
                </button>
              ))}
          </div>
        </Field>
        {isEdit && (
          <Field label="상태">
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="cp-input">
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            {isEdit ? '저장' : '추가'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export { ProblemModal }
