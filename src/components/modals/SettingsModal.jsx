import { useState } from 'react'
import { Loader2, Plus, Check } from 'lucide-react'
import { ModalShell } from '../ui/ModalShell'
import { Field } from '../ui/Field'

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function SettingsModal({ settings, onClose, onSave, onCreateRepo }) {
  const [form, setForm] = useState(settings)
  const [creating, setCreating] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  const handleCreateRepo = async () => {
    setCreating(true)
    try {
      await onCreateRepo(form)
    } finally {
      setCreating(false)
    }
  }

  return (
    <ModalShell title="GitHub 블로그 설정" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="GitHub Username" required>
          <input
            autoFocus
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="cp-input"
            placeholder="octocat"
          />
        </Field>
        <Field label="Repository Name" required>
          <input
            value={form.repo}
            onChange={(e) => setForm((f) => ({ ...f, repo: e.target.value }))}
            className="cp-input"
            placeholder="octocat.github.io"
          />
        </Field>
        <Field label="Branch">
          <input
            value={form.branch}
            onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
            className="cp-input"
            placeholder="main"
          />
        </Field>
        <Field label="Personal Access Token" required>
          <input
            type="password"
            value={form.pat}
            onChange={(e) => setForm((f) => ({ ...f, pat: e.target.value }))}
            className="cp-input font-mono"
            placeholder="ghp_..."
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            토큰은 이 브라우저의 localStorage에만 저장되며 외부로 전송되지 않습니다. 대상 저장소에 대한 Contents 읽기/쓰기 권한이 필요합니다.
          </p>
        </Field>

        <div className="pt-1">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">데이터 저장소 동기화</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="데이터 리포">
              <input
                value={form.dataRepo}
                onChange={(e) => setForm((f) => ({ ...f, dataRepo: e.target.value }))}
                className="cp-input"
                placeholder="cplog-data"
              />
            </Field>
            <Field label="데이터 브랜치">
              <input
                value={form.dataBranch}
                onChange={(e) => setForm((f) => ({ ...f, dataBranch: e.target.value }))}
                className="cp-input"
                placeholder="main"
              />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={form.autoSync !== false}
              onChange={(e) => setForm((f) => ({ ...f, autoSync: e.target.checked }))}
              className="h-3.5 w-3.5 accent-accent"
            />
            자동 동기화 (시작 시 가져오기 + 편집 후 자동 업로드)
          </label>
          <button
            type="button"
            onClick={handleCreateRepo}
            disabled={creating || !form.username.trim() || !form.pat.trim() || !form.dataRepo?.trim()}
            className="cp-btn-ghost mt-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} 데이터 리포 생성 (private)
          </button>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            보드는 problems.json, 노트는 notes/*.md 파일로 저장됩니다. 리포를 클론하면 노트를 Obsidian 등에서 바로 열 수 있습니다.
          </p>
        </div>

        <div className="pt-1">
          <div className="mb-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">저지 연동</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Codeforces 핸들">
              <input
                value={form.cfHandle || ''}
                onChange={(e) => setForm((f) => ({ ...f, cfHandle: e.target.value }))}
                className="cp-input"
                placeholder="tourist"
              />
            </Field>
            <Field label="AtCoder 핸들">
              <input
                value={form.atcoderHandle || ''}
                onChange={(e) => setForm((f) => ({ ...f, atcoderHandle: e.target.value }))}
                className="cp-input"
                placeholder="tourist"
              />
            </Field>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            핸들을 입력하면 시작 시 제출 이력을 읽어 AC된 문제를 자동으로 Done 처리합니다 (공개 API, 토큰 불필요). BOJ는 solved.ac가
            브라우저 호출을 막아 지원하지 않습니다.
          </p>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="cp-btn-ghost">
            취소
          </button>
          <button type="submit" className="cp-btn-primary">
            <Check size={15} /> 저장
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

export { SettingsModal }
