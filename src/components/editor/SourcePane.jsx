import { useEffect, useRef } from 'react'
import { EditorView as CMEditorView, lineNumbers, highlightActiveLine, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState, Transaction } from '@codemirror/state'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { autocompletion, startCompletion } from '@codemirror/autocomplete'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { uid } from '../../lib/utils'
import { MIME_EXT, assetCache, idbPutAsset } from '../../lib/assets'

// CodeMirror 테마 — 값을 전부 CSS 변수로 참조해 data-theme 전환 시 재생성 없이 자동 추종
const cmTheme = CMEditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'var(--color-surface)', color: 'var(--color-ink)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { padding: '20px 0', caretColor: 'var(--color-ink)' },
  '.cm-line': { padding: '0 20px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-ink)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: 'var(--color-accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-surface-alt) 60%, transparent)' },
  '.cm-gutters': { backgroundColor: 'var(--color-surface)', color: 'var(--color-ink-faint)', borderRight: '1px solid var(--color-border)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--color-surface-alt) 60%, transparent)',
    color: 'var(--color-ink-muted)',
  },
  '.cm-placeholder': { color: 'var(--color-ink-faint)' },
  '.cm-panels': { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-ink)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--color-border)' },
  // CM 기본 테마가 패널 인풋/버튼에 font-size 70%를 강제해 너무 작게 보임 — 명시 크기로 덮어씀
  '.cm-panel.cm-search': { fontFamily: 'var(--font-sans)', fontSize: '13px', padding: '10px 40px 10px 14px' },
  '.cm-panel.cm-search .cm-textfield': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    outline: 'none',
    fontSize: '13px',
    padding: '5px 10px',
  },
  '.cm-panel.cm-search .cm-textfield:focus': { borderColor: 'var(--color-accent)' },
  '.cm-panel.cm-search input[type="checkbox"]': {
    width: '13px',
    height: '13px',
    verticalAlign: 'text-top',
    accentColor: 'var(--color-accent)',
    marginRight: '4px',
  },
  '.cm-panel.cm-search button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-ink-muted)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '12.5px',
    padding: '5px 12px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search button:hover': { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-ink)' },
  '.cm-panel.cm-search [name="close"]': {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-ink-faint)',
    fontSize: '18px',
    lineHeight: '1',
    padding: '4px 8px',
    top: '8px',
    right: '8px',
    cursor: 'pointer',
  },
  '.cm-panel.cm-search [name="close"]:hover': { backgroundColor: 'transparent', color: 'var(--color-ink)' },
  '.cm-panel.cm-search label': { color: 'var(--color-ink-muted)', fontSize: '12.5px' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--color-warning) 55%, transparent)' },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgb(0 0 0 / 0.25)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-sans)', fontSize: '12.5px', maxHeight: '15em' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'var(--color-accent-soft)',
    color: 'var(--color-accent-strong)',
  },
  '.cm-completionDetail': { color: 'var(--color-ink-faint)', fontStyle: 'normal', marginLeft: '0.8em' },
})

// 마크다운 + 임베디드 코드블록(cpp/python 등 lazy load) 구문 강조 — 프리뷰(hljs)와 같은 --code-* 토큰 사용
const cmHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--color-ink)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-accent-strong)' },
  { tag: tags.quote, color: 'var(--color-ink-muted)', fontStyle: 'italic' },
  { tag: tags.monospace, color: 'var(--color-accent-strong)' },
  { tag: [tags.processingInstruction, tags.contentSeparator], color: 'var(--color-ink-faint)' },
  { tag: tags.comment, color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool], color: 'var(--code-number)' },
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--code-keyword)', fontWeight: '600' },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.standard(tags.variableName), tags.self], color: 'var(--code-builtin)' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: 'var(--code-title)', fontWeight: '600' },
  { tag: [tags.meta, tags.annotation], color: 'var(--code-meta)' },
])

const cmBaseExtensions = [
  lineNumbers(),
  highlightActiveLine(),
  history(),
  search(),
  CMEditorView.lineWrapping,
  markdown({ codeLanguages: languages }),
  syntaxHighlighting(cmHighlightStyle, { fallback: true }),
  cmTheme,
  cmPlaceholder('여기에 마크다운으로 풀이를 작성하세요...'),
  CMEditorView.contentAttributes.of({ spellcheck: 'false' }),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
]

// 붙여넣기/드롭한 이미지 파일을 assets/<id>.<ext> 파일로 처리하고 노트엔 ![](경로) 짧은 링크만 삽입.
// 실체 blob은 IndexedDB 캐시(+in-memory objectURL) → 프리뷰 즉시 표시, onAddAsset이 데이터 리포 업로드 큐에 등록.
const MAX_PASTE_IMAGE_BYTES = 10 * 1024 * 1024
function insertImageFile(view, file, pos, { onToast, onAddAsset }) {
  if (file.size > MAX_PASTE_IMAGE_BYTES) {
    onToast?.('error', '이미지가 너무 큽니다 (최대 10MB). 크기를 줄여주세요.')
    return
  }
  const ext = MIME_EXT[file.type] || 'png'
  const path = `assets/${uid()}.${ext}`
  // 프리뷰가 즉시 볼 수 있게 objectURL을 먼저 캐시하고, IndexedDB엔 영속 저장(백그라운드)
  assetCache.set(path, URL.createObjectURL(file))
  idbPutAsset(path, file).catch(() => {})
  onAddAsset?.(path)
  const at = pos ?? view.state.selection.main.from
  const insert = `![](${path})`
  view.dispatch({ changes: { from: at, to: at, insert }, selection: { anchor: at + insert.length } })
  view.focus()
}

function SourcePane({ noteId, content, onChange, viewRef, notes, problems, onToast, onAddAsset }) {
  const containerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onToastRef = useRef(onToast)
  onToastRef.current = onToast
  const onAddAssetRef = useRef(onAddAsset)
  onAddAssetRef.current = onAddAsset
  // CM이 마지막으로 알고 있는 내용 — 외부 변경(원격 pull)과 자체 편집을 구분해 루프 방지
  const lastContentRef = useRef(null)
  // [[ 자동완성이 항상 최신 목록을 읽도록 ref로 전달 (extensions는 1회만 생성되므로)
  const linkDataRef = useRef(null)
  linkDataRef.current = { notes, problems }

  const extensionsRef = useRef(null)
  if (extensionsRef.current === null) {
    // 옵시디언식 [[ 링크 자동완성 — 노트는 [[제목]], 문제는 [이름](url), 그룹(문제집)은 체크리스트로 삽입
    const linkCompletionSource = (context) => {
      const match = context.matchBefore(/\[\[([^\]\n]*)$/)
      if (!match) return null
      const { notes: ns, problems: ps } = linkDataRef.current
      const groups = new Map()
      for (const p of ps) {
        if (!p.group) continue
        if (!groups.has(p.group)) groups.set(p.group, [])
        groups.get(p.group).push(p)
      }
      const options = [
        ...ns
          .filter((n) => n.title?.trim())
          .map((n) => ({ label: n.title, detail: '노트', apply: `${n.title}]]` })),
        ...[...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
          .map(([name, rows]) => ({
            label: name,
            detail: `문제집 · ${rows.length}문제`,
            apply: (view, _completion, from, to) => {
              // 그룹 문제들을 등록순 GFM 체크리스트 스냅샷으로 펼쳐 삽입 (Done = 체크)
              const list = [...rows]
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
                .map((p) => `- [${p.status === 'done' ? 'x' : ' '}] ${p.url ? `[${p.name}](${p.url})` : p.name}`)
                .join('\n')
              // 리스트가 마크다운으로 렌더되도록 줄 경계 보정 — [[ 앞뒤에 같은 줄 내용이 있으면 개행
              const start = from - 2
              const doc = view.state.doc
              const before = start > doc.lineAt(start).from ? '\n' : ''
              const after = to < doc.lineAt(to).to ? '\n' : ''
              view.dispatch({
                changes: { from: start, to, insert: before + list + after },
                selection: { anchor: start + before.length + list.length },
              })
            },
          })),
        ...ps.map((p) => ({
          label: p.name,
          detail: p.platform,
          apply: (view, _completion, from, to) => {
            const insert = p.url ? `[${p.name}](${p.url})` : p.name
            // 여는 [[까지 포함해 통째로 마크다운 링크로 치환
            view.dispatch({
              changes: { from: from - 2, to, insert },
              selection: { anchor: from - 2 + insert.length },
            })
          },
        })),
      ]
      return { from: match.from + 2, options, validFor: /^[^\]\n]*$/ }
    }
    // 클립보드/드래그의 이미지 파일 → assets/ 삽입. 이미지가 없으면 false 반환해 기본 동작(텍스트) 유지.
    const imgHandlers = () => ({ onToast: onToastRef.current, onAddAsset: onAddAssetRef.current })
    const imageEventHandlers = CMEditorView.domEventHandlers({
      paste: (event, view) => {
        const items = [...(event.clipboardData?.items || [])]
        const item = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'))
        if (!item) return false
        const file = item.getAsFile()
        if (!file) return false
        event.preventDefault()
        insertImageFile(view, file, null, imgHandlers())
        return true
      },
      drop: (event, view) => {
        const file = [...(event.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'))
        if (!file) return false // 사이드바 노트 DnD 등 파일 아닌 드롭은 그대로 통과
        event.preventDefault()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        insertImageFile(view, file, pos, imgHandlers())
        return true
      },
    })
    extensionsRef.current = [
      ...cmBaseExtensions,
      imageEventHandlers,
      autocompletion({ override: [linkCompletionSource], icons: false }),
      keymap.of([
        {
          key: 'Mod-Shift-l',
          run: (view) => {
            const { from, to } = view.state.selection.main
            view.dispatch({ changes: { from, to, insert: '[[' }, selection: { anchor: from + 2 } })
            startCompletion(view)
            return true
          },
        },
      ]),
      CMEditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        // 원격 반영용 dispatch(Transaction.remote 주석)는 앱 상태로 되돌리지 않음
        if (update.transactions.every((tr) => tr.annotation(Transaction.remote))) return
        const text = update.state.doc.toString()
        lastContentRef.current = text
        onChangeRef.current(text)
      }),
    ]
  }

  // 뷰 생성(1회) + 노트 전환 시 문서/undo 히스토리 리셋
  useEffect(() => {
    if (!viewRef.current) viewRef.current = new CMEditorView({ parent: containerRef.current })
    lastContentRef.current = content
    viewRef.current.setState(EditorState.create({ doc: content || '', extensions: extensionsRef.current }))
  }, [noteId])

  useEffect(
    () => () => {
      viewRef.current?.destroy()
      viewRef.current = null
    },
    [],
  )

  // 같은 노트의 content가 밖에서 바뀐 경우(원격 pull 채택 등) 문서 교체
  useEffect(() => {
    const view = viewRef.current
    if (!view || content === lastContentRef.current) return
    const current = view.state.doc.toString()
    lastContentRef.current = content
    if (content === current) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: content || '' },
      annotations: Transaction.remote.of(true),
    })
  }, [content])

  return <div ref={containerRef} className="h-full overflow-hidden bg-surface" />
}

export { SourcePane }
