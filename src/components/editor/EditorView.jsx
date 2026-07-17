import { useRef } from 'react'
import { FileText, Plus } from 'lucide-react'
import { renderSnippetVars, renderSnippet } from '../../lib/snippets'
import { EditorMetaBar } from './EditorMetaBar'
import { SourcePane } from './SourcePane'
import { MarkdownPreview } from './MarkdownPreview'
import { BacklinksBar } from './BacklinksBar'

function EmptyEditorState({ onNew }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <FileText size={32} className="text-ink-faint" />
      <p className="text-sm text-ink-muted">
        아직 열린 노트가 없습니다.
        <br />
        To Solve 보드에서 문제를 Done으로 옮기거나 새 노트를 만들어보세요.
      </p>
      <button onClick={onNew} className="cp-btn-primary mt-1">
        <Plus size={15} /> 새 노트 만들기
      </button>
    </div>
  )
}

function EditorView({
  activeNote,
  onNewNote,
  onUpdateNote,
  onPublish,
  publishing,
  editorMode,
  onSetEditorMode,
  snippets,
  onManageSnippets,
  notes,
  problems,
  onOpenWikiLink,
  onSelectNote,
  onToast,
  onAddAsset,
  resolveAsset,
}) {
  const cmViewRef = useRef(null)

  // 커서 위치에 변수 치환된 스니펫 삽입, {{cursor}} 지점으로 캐럿 이동
  const insertSnippet = (snippet) => {
    const view = cmViewRef.current
    if (!activeNote || !view) return
    // 제목 없는 노트에 제목 템플릿 있는 스니펫을 삽입하면 노트 제목도 함께 설정
    const snippetTitle = renderSnippetVars(snippet.title || '').trim()
    const applyTitle = !!snippetTitle && !(activeNote.title || '').trim()
    if (applyTitle) onUpdateNote(activeNote.id, { title: snippetTitle })
    const { text, cursorOffset } = renderSnippet(snippet.content, { title: applyTitle ? snippetTitle : activeNote.title })
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + cursorOffset },
      scrollIntoView: true,
    })
    view.focus()
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {activeNote ? (
        <>
          <EditorMetaBar
            note={activeNote}
            onChange={(patch) => onUpdateNote(activeNote.id, patch)}
            onPublish={() => onPublish(activeNote)}
            publishing={publishing}
            editorMode={editorMode}
            onSetEditorMode={onSetEditorMode}
            snippets={snippets}
            onInsertSnippet={insertSnippet}
            onManageSnippets={onManageSnippets}
          />
          <div className="flex-1 overflow-hidden">
            {editorMode === 'preview' ? (
              <MarkdownPreview content={activeNote.content} notes={notes} onOpenWikiLink={onOpenWikiLink} resolveAsset={resolveAsset} />
            ) : (
              <SourcePane
                noteId={activeNote.id}
                content={activeNote.content}
                onChange={(content) => onUpdateNote(activeNote.id, { content })}
                viewRef={cmViewRef}
                notes={notes}
                problems={problems}
                onToast={onToast}
                onAddAsset={onAddAsset}
              />
            )}
          </div>
          <BacklinksBar activeNote={activeNote} notes={notes} onSelectNote={onSelectNote} />
        </>
      ) : (
        <EmptyEditorState onNew={onNewNote} />
      )}
    </div>
  )
}

export { EditorView }
