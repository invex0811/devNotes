import { NOTE_STATUSES, type Note, type NoteStatus, type Scope } from '@devnotes/core'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import { useMemo, useState, type KeyboardEventHandler, type ReactNode } from 'react'
import { strings } from '../../i18n'
import { useActions, useLabels, useProjectName, useVisibleNotes } from '../../store/hooks'
import { STATUS_SOLID, STATUS_TEXT } from '../../ui/theme'
import { NoteCard } from '../notes/NoteCard'

const columnId = (status: NoteStatus) => `column-${status}`

function statusOfColumn(id: UniqueIdentifier | undefined): NoteStatus | null {
  return NOTE_STATUSES.find((status) => columnId(status) === id) ?? null
}

/**
 * Keyboard dragging: the left and right arrows jump to the neighbouring column
 * instead of nudging the card by a few pixels.
 */
const jumpBetweenColumns: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = event.code === 'ArrowRight' ? 1 : event.code === 'ArrowLeft' ? -1 : 0
  const card = context.collisionRect
  if (direction === 0 || !card) return undefined
  event.preventDefault()
  const columns = [...context.droppableRects.values()].toSorted((a, b) => a.left - b.left)
  const center = card.left + card.width / 2
  const current = columns.findIndex((rect) => center >= rect.left && center <= rect.right)
  const target = columns[Math.min(Math.max(current + direction, 0), columns.length - 1)]
  if (!target) return undefined
  return { x: target.left + (target.width - card.width) / 2, y: target.top + 48 }
}

/** Three columns by status for the current scope and filter; dragging changes the status. */
export function Board({ scope }: { scope: Scope }) {
  const notes = useVisibleNotes(scope)
  const actions = useActions()
  const labels = useLabels()
  const projectName = useProjectName()
  const [active, setActive] = useState<Note | null>(null)
  const now = new Date()

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: jumpBetweenColumns }),
  )

  const columns = useMemo(
    () =>
      NOTE_STATUSES.map((status) => ({
        status,
        notes: notes.filter((note) => note.status === status),
      })),
    [notes],
  )

  const titleOf = (id: UniqueIdentifier) => {
    const title = notes.find((note) => note.id === id)?.title ?? ''
    return title === '' ? strings.note.untitled : title
  }
  const columnName = (id: UniqueIdentifier | undefined) => {
    const status = statusOfColumn(id)
    return status ? strings.status.names[status] : ''
  }

  const announcements: Announcements = {
    onDragStart: ({ active: card }) => `${strings.board.picked}: ${titleOf(card.id)}`,
    onDragOver: ({ over }) => (over ? `${strings.board.over} «${columnName(over.id)}»` : undefined),
    onDragEnd: ({ over }) =>
      over ? `${strings.board.moved} «${columnName(over.id)}»` : strings.board.cancelled,
    onDragCancel: () => strings.board.cancelled,
  }

  const onDragEnd = ({ active: card, over }: DragEndEvent) => {
    setActive(null)
    const status = statusOfColumn(over?.id)
    if (status) actions.setStatus(String(card.id), status)
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: strings.board.instructions },
      }}
      onDragStart={({ active: card }) => {
        setActive(notes.find((note) => note.id === card.id) ?? null)
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null)
      }}
    >
      <div
        aria-label={strings.board.label}
        role="region"
        className="-mx-4 flex snap-x snap-mandatory items-start gap-3.5 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
      >
        {columns.map((column) => (
          <BoardColumn
            key={column.status}
            status={column.status}
            notes={column.notes}
            dragging={active !== null && active.status !== column.status}
            renderCard={(note) => (
              <NoteCard
                note={note}
                variant="board"
                labels={labels}
                now={now}
                projectName={projectName(note.projectId)}
              />
            )}
          />
        ))}
      </div>
      <DragOverlay>
        {active && (
          <div className="rotate-1 shadow-2xl">
            <NoteCard
              note={active}
              variant="board"
              labels={labels}
              now={now}
              projectName={projectName(active.projectId)}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

interface BoardColumnProps {
  status: NoteStatus
  notes: readonly Note[]
  /** A card from another column is being dragged: show where it can go. */
  dragging: boolean
  renderCard: (note: Note) => ReactNode
}

function BoardColumn({ status, notes, dragging, renderCard }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status) })
  const name = strings.status.names[status]

  return (
    <section
      ref={setNodeRef}
      aria-label={`${name}: ${String(notes.length)}`}
      className={`w-[85vw] max-w-sm shrink-0 snap-start rounded-card border bg-sidebar p-3 md:w-auto md:max-w-none ${isOver ? 'border-accent' : 'border-line'}`}
    >
      <h2 className="flex items-center gap-2 px-1.5 pt-1 pb-3">
        <span aria-hidden="true" className={`size-2 rounded-full ${STATUS_SOLID[status]}`} />
        <span className={`text-[15px] font-semibold ${STATUS_TEXT[status]}`}>{name}</span>
        <span className="ml-auto font-mono text-xs text-fg-muted">{notes.length}</span>
      </h2>
      <ul className="space-y-2.5">
        {notes.map((note) => (
          <DraggableCard key={note.id} note={note}>
            {renderCard(note)}
          </DraggableCard>
        ))}
      </ul>
      {(dragging || notes.length === 0) && (
        <p
          className={`mt-2.5 rounded-card border border-dashed px-4 py-8 text-center text-sm ${isOver ? 'border-accent text-fg' : 'border-line text-fg-muted'}`}
        >
          {strings.board.dropHere}
        </p>
      )}
    </section>
  )
}

/**
 * The mouse and a finger drag the whole card. From the keyboard a separate move
 * button picks it up (it shows on focus), so the card keeps its own buttons and
 * the list stays a plain list.
 */
function DraggableCard({ note, children }: { note: Note; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: note.id,
    attributes: { roleDescription: strings.board.label },
  })
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  const title = note.title === '' ? strings.note.untitled : note.title
  return (
    <li
      ref={setNodeRef}
      {...pointerListeners}
      className={`relative touch-manipulation rounded-card ${isDragging ? 'opacity-40' : ''}`}
    >
      {children}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
        aria-label={`${strings.board.move}: ${title}`}
        className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-control bg-panel text-fg-secondary opacity-0 focus-visible:opacity-100"
      >
        <GripVertical aria-hidden="true" size={16} />
      </button>
    </li>
  )
}
