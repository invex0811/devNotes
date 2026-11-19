import { NOTE_COLORS, hasLabel, parseBody, showsSolution, type Note } from '@devnotes/core'
import { Check, ChevronDown, Pin, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { strings } from '../../i18n'
import { useActions, useApp, useLabels, useProjects } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { Modal } from '../../ui/Modal'
import { StatusPill } from '../../ui/StatusPill'
import {
  dangerButtonClass,
  iconButtonClass,
  secondaryButtonClass,
  touchTargetClass,
} from '../../ui/styles'
import { NOTE_SURFACE, TAG_TEXT, TAG_TINT } from '../../ui/theme'
import { formatNoteDate } from './formatDate'
import { labelColor } from './labelColor'

/** Value of the "no project" option; real project ids are never empty. */
const NO_PROJECT = ''

/** Shows the note that is currently open, if any. */
export function NoteDialog() {
  const note = useApp((state) =>
    state.openNoteId === null
      ? undefined
      : state.notes.find((candidate) => candidate.id === state.openNoteId),
  )
  if (!note || note.deleted) return null
  return <NoteDialogContent key={note.id} note={note} />
}

function NoteDialogContent({ note }: { note: Note }) {
  const actions = useActions()
  const labels = useLabels()
  const projects = useProjects()
  const [labelsOpen, setLabelsOpen] = useState(false)
  const checklist = parseBody(note.body).filter((line) => line.kind === 'item')

  const patch = (change: Parameters<typeof actions.patchNote>[1]) => {
    actions.patchNote(note.id, change)
  }

  return (
    <Modal label={strings.note.dialogLabel} onClose={actions.closeNote} widthClass="max-w-3xl">
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-1">
          <label className="relative mr-auto flex min-h-11 min-w-0 items-center gap-2 rounded-control border border-line bg-page pr-9 pl-3">
            <span className="font-mono text-xs text-fg-muted">{strings.note.projectLabel}</span>
            <select
              value={note.projectId ?? NO_PROJECT}
              onChange={(event) => {
                patch({ projectId: event.target.value === NO_PROJECT ? null : event.target.value })
              }}
              className="min-h-11 min-w-0 appearance-none truncate bg-page text-[15px] font-semibold text-fg"
            >
              <option value={NO_PROJECT}>{strings.project.none}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute right-3 text-fg-secondary"
            />
          </label>

          <button
            type="button"
            aria-pressed={note.pinned}
            aria-label={note.pinned ? strings.note.unpin : strings.note.pin}
            title={note.pinned ? strings.note.unpin : strings.note.pin}
            onClick={() => {
              patch({ pinned: !note.pinned })
            }}
            className={`${iconButtonClass} ${note.pinned ? 'text-accent hover:text-accent' : ''}`}
          >
            <Pin size={20} fill={note.pinned ? 'currentColor' : 'none'} className="rotate-45" />
          </button>
          <button
            type="button"
            aria-label={strings.common.close}
            title={strings.common.close}
            onClick={actions.closeNote}
            className={iconButtonClass}
          >
            <X size={22} />
          </button>
        </div>

        {/* A text area that grows, so a long title wraps instead of being cut on a phone.
            A title is one line: Enter adds no line break and pasted ones become spaces. */}
        <textarea
          value={note.title}
          onChange={(event) => {
            patch({ title: event.target.value.replace(/\s*\n\s*/g, ' ') })
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          aria-label={strings.note.titleLabel}
          placeholder={strings.note.titlePlaceholder}
          maxLength={200}
          rows={1}
          className="mt-5 field-sizing-content min-h-11 w-full resize-none rounded-sm bg-transparent text-2xl leading-snug font-bold tracking-tight text-fg placeholder:text-fg-muted"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusPill
            status={note.status}
            onCycle={() => {
              actions.cycleStatus(note.id)
            }}
          />
          {note.labels.map((name) => (
            <LabelBadge key={name} name={name} color={labelColor(labels, name)} />
          ))}
          <button
            type="button"
            aria-expanded={labelsOpen}
            onClick={() => {
              setLabelsOpen(!labelsOpen)
            }}
            className={`${touchTargetClass} inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line px-2 text-[13px] text-fg-secondary hover:border-fg-muted hover:text-fg`}
          >
            <Plus aria-hidden="true" size={14} />
            {strings.note.addLabel}
          </button>
        </div>

        {labelsOpen && (
          <div
            role="group"
            aria-label={strings.note.labelsPanel}
            className="mt-3 flex flex-wrap gap-2 rounded-control border border-divider bg-page p-3"
          >
            {labels.map((label) => {
              const active = hasLabel(note.labels, label.name)
              return (
                <button
                  key={label.name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    actions.toggleNoteLabel(note.id, label.name)
                  }}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2.5 font-mono text-xs font-medium ${TAG_TEXT[label.color]} ${active ? TAG_TINT[label.color] : 'border border-line'}`}
                >
                  {active && <Check aria-hidden="true" size={14} />}
                  {label.name}
                </button>
              )
            })}
          </div>
        )}

        <textarea
          value={note.body}
          onChange={(event) => {
            patch({ body: event.target.value })
          }}
          aria-label={strings.note.bodyLabel}
          placeholder={strings.note.bodyPlaceholder}
          maxLength={20000}
          rows={Math.min(18, Math.max(5, note.body.split('\n').length + 1))}
          className="-mx-3 mt-4 field-sizing-content max-h-[45dvh] min-h-32 w-[calc(100%+1.5rem)] resize-none rounded-control border border-transparent bg-transparent px-3 py-2 text-[15px] leading-relaxed text-fg placeholder:text-fg-muted hover:border-divider focus:border-line"
        />

        {checklist.length > 0 && (
          <fieldset className="mt-3 rounded-control border border-divider bg-page p-3">
            <legend className="px-1 font-mono text-[11px] tracking-[0.12em] text-fg-muted uppercase">
              {strings.note.checklist}
            </legend>
            <ul className="space-y-1">
              {checklist.map((item) => (
                <li key={item.line}>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[15px]">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => {
                        actions.toggleChecklistItem(note.id, item.line)
                      }}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <span className={item.checked ? 'text-fg-muted line-through' : 'text-fg'}>
                      {item.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {showsSolution(note) && (
          <section className="mt-5 rounded-card border border-tag-blue/40 bg-tag-blue/5 p-4">
            <label
              htmlFor="note-solution"
              className="flex items-center gap-2 font-semibold text-tag-blue"
            >
              <Check aria-hidden="true" size={18} />
              {strings.solution.title}
            </label>
            <textarea
              id="note-solution"
              value={note.solution}
              onChange={(event) => {
                patch({ solution: event.target.value })
              }}
              aria-describedby="note-solution-hint"
              placeholder={strings.solution.placeholder}
              maxLength={20000}
              rows={3}
              className="mt-3 field-sizing-content max-h-[30dvh] min-h-20 w-full resize-none rounded-control border border-line bg-page px-3 py-2.5 text-[15px] leading-relaxed text-fg placeholder:text-fg-muted"
            />
            <p id="note-solution-hint" className="mt-2 text-sm text-fg-secondary">
              {strings.solution.hint}
            </p>
          </section>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-divider pt-5">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">{strings.note.colorLabel}</legend>
            {NOTE_COLORS.map((color) => (
              <label
                key={color}
                title={strings.note.colors[color]}
                className={`${touchTargetClass} cursor-pointer`}
              >
                <input
                  type="radio"
                  name="note-color"
                  value={color}
                  checked={note.color === color}
                  onChange={() => {
                    patch({ color })
                  }}
                  aria-label={strings.note.colors[color]}
                  className="peer sr-only"
                />
                <span
                  className={`block size-8 rounded-full border border-line peer-checked:border-2 peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${NOTE_SURFACE[color]}`}
                />
              </label>
            ))}
          </fieldset>

          <p className="mr-auto font-mono text-xs text-fg-muted">
            {strings.note.changed} {formatNoteDate(note.updatedAt, new Date())}
            {note.source !== 'user' && <> · {strings.note.createdByAi}</>}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                patch({ archived: !note.archived })
                actions.closeNote()
              }}
              className={secondaryButtonClass}
            >
              {note.archived ? strings.note.unarchive : strings.note.archive}
            </button>
            <button
              type="button"
              onClick={() => {
                actions.deleteNote(note.id)
              }}
              className={dangerButtonClass}
            >
              {strings.note.delete}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
