import { useState, useRef } from 'react'
import {
  Github, LayoutGrid, FileText, ChartColumn, Settings, Sun, Moon, ChevronsLeft, ChevronsRight,
  Cloud, CloudOff, CloudUpload, RefreshCw, TriangleAlert, CheckCircle2, Clock, Trash2,
  ChevronRight, Folder, Plus, Pencil, FolderPlus, X,
} from 'lucide-react'
import { FOLDER_COLORS } from '../../constants'
import { cn, formatDateTime } from '../../lib/utils'

function NavItem({ icon: Icon, label, active, collapsed, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        'relative flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0' : 'px-3',
        active ? 'bg-accent-soft text-accent-strong' : 'text-ink-muted hover:bg-surface-alt hover:text-ink',
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      {badge > 0 &&
        (collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warning" />
        ) : (
          <span className="shrink-0 rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning">{badge}</span>
        ))}
    </button>
  )
}

function SyncIndicator({ status, lastSyncAt, collapsed, onClick }) {
  const META = {
    off: { icon: CloudOff, cls: 'text-ink-faint', label: '동기화 꺼짐', sub: '설정에서 데이터 리포 연결' },
    idle: { icon: Cloud, cls: 'text-success', label: '동기화됨', sub: lastSyncAt ? formatDateTime(lastSyncAt) : null },
    dirty: { icon: CloudUpload, cls: 'text-warning', label: '동기화 대기 중', sub: '클릭하여 지금 동기화' },
    syncing: { icon: RefreshCw, cls: 'text-accent', label: '동기화 중...', sub: null, spin: true },
    error: { icon: TriangleAlert, cls: 'text-danger', label: '동기화 오류', sub: '클릭하여 재시도' },
  }
  const meta = META[status] || META.off
  const Icon = meta.icon
  return (
    <button
      onClick={onClick}
      title={collapsed ? meta.label : undefined}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg py-2 text-sm font-medium transition-colors hover:bg-surface-alt',
        collapsed ? 'justify-center px-0' : 'px-3',
      )}
    >
      <Icon size={17} strokeWidth={2} className={cn('shrink-0', meta.cls, meta.spin && 'animate-spin')} />
      {!collapsed && (
        <span className="min-w-0 text-left">
          <span className="block truncate text-ink-muted">{meta.label}</span>
          {meta.sub && <span className="block truncate text-[10.5px] font-normal text-ink-faint">{meta.sub}</span>}
        </span>
      )}
    </button>
  )
}

// 폴더 트리 헬퍼 — parentId 기반 중첩. 부모가 사라진 폴더(동기화 경합 등)는 루트로 승격해 잃지 않는다.
function buildFolderTree(folders) {
  const ids = new Set(folders.map((f) => f.id))
  const byParent = new Map()
  const sorted = [...folders].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'))
  for (const f of sorted) {
    const parent = f.parentId && ids.has(f.parentId) ? f.parentId : null
    if (!byParent.has(parent)) byParent.set(parent, [])
    byParent.get(parent).push(f)
  }
  return byParent
}

const noteDragPayload = 'text/cplog-note'

function SidebarNoteRow({ note, active, selected, depth, onRowClick, onDragStartNote, onDelete }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStartNote(e, note.id)}
      className={cn(
        'group mb-0.5 flex items-center gap-1 rounded-lg py-1 pr-1',
        selected ? 'bg-accent-soft ring-1 ring-inset ring-accent/50' : active ? 'bg-accent-soft' : 'hover:bg-surface-alt',
      )}
      style={{ paddingLeft: 4 + depth * 14 }}
    >
      <button onClick={(e) => onRowClick(e, note.id)} className="min-w-0 flex-1 select-none rounded-lg px-1.5 py-1 text-left">
        <p className={cn('truncate text-[12.5px] font-semibold', active || selected ? 'text-accent-strong' : 'text-ink')}>
          {note.title || '제목 없음'}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-faint">
          {note.published ? <CheckCircle2 size={10} className="text-success" /> : <Clock size={10} />}
          {note.published ? '발행됨' : '초안'}
        </p>
      </button>
      <button
        onClick={() => onDelete(note.id)}
        className="shrink-0 rounded p-1 text-ink-faint opacity-0 hover:bg-danger-soft hover:text-danger group-hover:opacity-100"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function parseNoteDragIds(e) {
  try {
    return JSON.parse(e.dataTransfer.getData(noteDragPayload))
  } catch {
    return null
  }
}

function FolderTreeNode({ folder, depth, byParent, notes, activeNoteId, selectedNotes, collapsedFolders, actions }) {
  const [dragOver, setDragOver] = useState(false)
  const open = !collapsedFolders.includes(folder.id)
  const childFolders = byParent.get(folder.id) || []
  const childNotes = notes.filter((n) => n.folderId === folder.id)
  const color = FOLDER_COLORS[folder.color]
  return (
    <div>
      <div
        onDragOver={(e) => {
          if ([...e.dataTransfer.types].includes(noteDragPayload)) {
            e.preventDefault()
            setDragOver(true)
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.stopPropagation()
          setDragOver(false)
          const ids = parseNoteDragIds(e)
          if (ids) actions.onMoveNotes(ids, folder.id)
        }}
        className={cn(
          'group mb-0.5 flex items-center gap-0.5 rounded-lg py-1 pr-1',
          dragOver ? 'bg-accent-soft outline-dashed outline-1 outline-accent' : 'hover:bg-surface-alt',
        )}
        style={{ paddingLeft: 4 + depth * 14 }}
      >
        <button onClick={() => actions.onToggleFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-0.5 text-left">
          <ChevronRight size={12} className={cn('shrink-0 text-ink-faint transition-transform', open && 'rotate-90')} />
          {folder.emoji ? (
            <span className="w-4 shrink-0 text-center text-[13px] leading-none">{folder.emoji}</span>
          ) : (
            <Folder size={14} className={cn('shrink-0', !color && 'text-ink-muted')} style={color ? { color } : undefined} />
          )}
          <span className={cn('min-w-0 flex-1 truncate text-[12.5px] font-semibold', !color && 'text-ink')} style={color ? { color } : undefined}>
            {folder.name}
          </span>
        </button>
        <span className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
          <button
            onClick={() => actions.onNewNoteInFolder(folder.id)}
            title="이 폴더에 새 노트"
            className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-accent"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => actions.onEditFolder(folder)}
            title="폴더 편집"
            className="rounded p-1 text-ink-faint hover:bg-surface-alt hover:text-ink"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={() => actions.onDeleteFolder(folder)}
            title="폴더 삭제"
            className="rounded p-1 text-ink-faint hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 size={11} />
          </button>
        </span>
      </div>
      {open && (
        <div>
          {childFolders.map((f) => (
            <FolderTreeNode
              key={f.id}
              folder={f}
              depth={depth + 1}
              byParent={byParent}
              notes={notes}
              activeNoteId={activeNoteId}
              selectedNotes={selectedNotes}
              collapsedFolders={collapsedFolders}
              actions={actions}
            />
          ))}
          {childNotes.map((n) => (
            <SidebarNoteRow
              key={n.id}
              note={n}
              active={n.id === activeNoteId}
              selected={selectedNotes.has(n.id)}
              depth={depth + 1}
              onRowClick={actions.onNoteRowClick}
              onDragStartNote={actions.onDragStartNote}
              onDelete={actions.onDeleteNote}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({
  activeView,
  onNavigate,
  onOpenSettings,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  notes,
  folders,
  collapsedFolders,
  folderActions,
  activeNoteId,
  onSelectNote,
  onNewNote,
  onNewFolder,
  onDeleteNote,
  syncStatus,
  lastSyncAt,
  onSyncClick,
  reviewDueCount,
}) {
  const showNotesList = activeView === 'editor' && !collapsed
  const byParent = buildFolderTree(folders)
  const folderIds = new Set(folders.map((f) => f.id))
  const rootFolders = byParent.get(null) || []
  // 폴더가 없는(또는 폴더가 사라진) 노트는 루트에
  const rootNotes = notes.filter((n) => !n.folderId || !folderIds.has(n.folderId))

  // 노트 다중 선택 (클릭=열기+단일선택 / Shift=범위 / Ctrl=토글) + 선택 통째 폴더 드래그
  const [selectedNotes, setSelectedNotes] = useState(() => new Set())
  const noteAnchorRef = useRef(null)

  // Shift-범위용 보이는(펼쳐진 폴더) 노트의 렌더 순서 — 폴더의 하위폴더 먼저, 그다음 그 폴더 노트, 마지막에 루트 노트
  const visibleNoteOrder = []
  const walkNotes = (folder) => {
    if (collapsedFolders.includes(folder.id)) return
    for (const f of byParent.get(folder.id) || []) walkNotes(f)
    for (const n of notes.filter((n) => n.folderId === folder.id)) visibleNoteOrder.push(n.id)
  }
  for (const f of rootFolders) walkNotes(f)
  for (const n of rootNotes) visibleNoteOrder.push(n.id)

  const onNoteRowClick = (e, id) => {
    if (e.shiftKey && noteAnchorRef.current != null) {
      const a = visibleNoteOrder.indexOf(noteAnchorRef.current)
      const b = visibleNoteOrder.indexOf(id)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        setSelectedNotes(new Set(visibleNoteOrder.slice(lo, hi + 1)))
      }
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedNotes((s) => {
        const n = new Set(s)
        n.has(id) ? n.delete(id) : n.add(id)
        return n
      })
      noteAnchorRef.current = id
    } else {
      setSelectedNotes(new Set([id]))
      noteAnchorRef.current = id
      onSelectNote(id)
    }
  }

  const onDragStartNote = (e, id) => {
    const ids = selectedNotes.has(id) ? [...selectedNotes] : [id]
    if (!selectedNotes.has(id)) {
      setSelectedNotes(new Set([id]))
      noteAnchorRef.current = id
    }
    e.dataTransfer.setData(noteDragPayload, JSON.stringify(ids))
    e.dataTransfer.effectAllowed = 'move'
  }

  const treeActions = { ...folderActions, onNoteRowClick, onDragStartNote, onDeleteNote }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-150',
        collapsed ? 'w-14' : 'w-64',
      )}
    >
      <div className={cn('flex items-center gap-2.5 py-4', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
          <Github size={17} strokeWidth={2.2} />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-sans text-[15px] font-bold leading-none text-ink">CP-Log</p>
            <p className="mt-1 truncate text-[11px] text-ink-faint">PS 개인 노트</p>
          </div>
        )}
      </div>

      <nav className="space-y-1 px-2.5">
        <NavItem
          icon={LayoutGrid}
          label="풀 문제"
          active={activeView === 'board'}
          collapsed={collapsed}
          onClick={() => onNavigate('board')}
          badge={reviewDueCount}
        />
        <NavItem icon={FileText} label="에디터" active={activeView === 'editor'} collapsed={collapsed} onClick={() => onNavigate('editor')} />
        <NavItem icon={ChartColumn} label="통계" active={activeView === 'stats'} collapsed={collapsed} onClick={() => onNavigate('stats')} />
      </nav>

      {showNotesList ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-border pt-2">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">노트</span>
            <div className="flex items-center gap-0.5">
              <button onClick={onNewFolder} title="새 폴더" className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-accent">
                <FolderPlus size={14} />
              </button>
              <button
                onClick={onNewNote}
                title="새 노트 (Ctrl+Alt+N)"
                className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-accent"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          {selectedNotes.size > 1 && (
            <p className="mx-2 mb-1 flex items-center justify-between rounded-md bg-accent-soft px-2 py-1 text-[10.5px] text-accent-strong">
              <span className="font-semibold">{selectedNotes.size}개 선택 · 폴더로 드래그</span>
              <button onClick={() => setSelectedNotes(new Set())} className="text-ink-faint hover:text-ink">
                <X size={11} />
              </button>
            </p>
          )}
          {/* 리스트 빈 영역에 드롭하면 폴더 해제(루트로 이동) — 폴더 행 드롭은 stopPropagation으로 여기까지 오지 않음 */}
          <div
            className="flex-1 overflow-y-auto px-2 pb-2"
            onDragOver={(e) => {
              if ([...e.dataTransfer.types].includes(noteDragPayload)) e.preventDefault()
            }}
            onDrop={(e) => {
              const ids = parseNoteDragIds(e)
              if (ids) folderActions.onMoveNotes(ids, null)
            }}
          >
            {notes.length === 0 && folders.length === 0 && (
              <p className="px-2 py-4 text-center text-[11px] text-ink-faint">아직 작성한 노트가 없습니다</p>
            )}
            {rootFolders.map((f) => (
              <FolderTreeNode
                key={f.id}
                folder={f}
                depth={0}
                byParent={byParent}
                notes={notes}
                activeNoteId={activeNoteId}
                selectedNotes={selectedNotes}
                collapsedFolders={collapsedFolders}
                actions={treeActions}
              />
            ))}
            {rootNotes.map((n) => (
              <SidebarNoteRow
                key={n.id}
                note={n}
                active={n.id === activeNoteId}
                selected={selectedNotes.has(n.id)}
                depth={0}
                onRowClick={onNoteRowClick}
                onDragStartNote={onDragStartNote}
                onDelete={onDeleteNote}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="space-y-1 border-t border-border px-2.5 py-3">
        <SyncIndicator status={syncStatus} lastSyncAt={lastSyncAt} collapsed={collapsed} onClick={onSyncClick} />
        <NavItem
          icon={theme === 'dark' ? Sun : Moon}
          label={theme === 'dark' ? '라이트 모드' : '다크 모드'}
          collapsed={collapsed}
          onClick={onToggleTheme}
        />
        <NavItem icon={Settings} label="설정" collapsed={collapsed} onClick={onOpenSettings} />
        <NavItem
          icon={collapsed ? ChevronsRight : ChevronsLeft}
          label={collapsed ? '펼치기' : '접기'}
          collapsed={collapsed}
          onClick={onToggleCollapse}
        />
      </div>
    </aside>
  )
}

export { Sidebar }
