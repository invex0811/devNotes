import type { Note } from '@devnotes/core'
import { useState } from 'react'
import { strings } from '../../i18n'
import { useActions, useLabels, useProjectName, useReviewNotes } from '../../store/hooks'
import { LabelBadge } from '../../ui/LabelBadge'
import { Modal } from '../../ui/Modal'
import { dangerButtonClass, primaryButtonClass, secondaryButtonClass } from '../../ui/styles'
import { formatNoteDate } from '../notes/formatDate'
import { labelColor } from '../notes/labelColor'

/**
 * "На проверку": cards from AI wait here until the user accepts or deletes them.
 * A click on a card opens it, so its text can be corrected before accepting.
 */
export function ReviewPage() {
  const notes = useReviewNotes()
  const actions = useActions()
  const [confirming, setConfirming] = useState(false)
  const ids = notes.map((note) => note.id)

  return (
    <section aria-label={strings.nav.review} className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="mr-auto text-fg-secondary">{strings.review.lead}</p>
        {notes.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => {
                setConfirming(true)
              }}
              className={dangerButtonClass}
            >
              {strings.review.deleteAll}
            </button>
            <button
              type="button"
              onClick={() => {
                actions.acceptReview(ids)
              }}
              className={primaryButtonClass}
            >
              {strings.review.acceptAll} ({notes.length})
            </button>
          </>
        )}
      </div>

      {notes.length === 0 ? (
        <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
          <p className="text-base font-semibold text-fg">{strings.review.empty}</p>
          <p className="mt-2 text-sm text-fg-muted">{strings.review.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-3.5">
          {notes.map((note) => (
            <ReviewCard key={note.id} note={note} />
          ))}
        </div>
      )}

      {confirming && (
        <Modal
          label={strings.review.deleteAllTitle}
          onClose={() => {
            setConfirming(false)
          }}
        >
          <div className="space-y-4 p-6">
            <h2 className="text-lg font-semibold text-fg">{strings.review.deleteAllTitle}</h2>
            <p className="text-fg-secondary">{strings.review.deleteAllText}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                }}
                className={secondaryButtonClass}
              >
                {strings.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false)
                  actions.deleteNotes(ids)
                }}
                className={dangerButtonClass}
              >
                {strings.review.deleteAllConfirm}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

function ReviewCard({ note }: { note: Note }) {
  const actions = useActions()
  const labels = useLabels()
  const projectName = useProjectName()
  const meta = [
    projectName(note.projectId),
    strings.review.source[note.source],
    formatNoteDate(note.createdAt, new Date()),
  ].filter((part) => part !== '')

  return (
    <article
      onClick={() => {
        actions.openNote(note.id)
      }}
      className="flex cursor-pointer flex-col rounded-card border border-line bg-card p-4 hover:border-fg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-7 items-center rounded-md border border-accent px-2 font-mono text-xs font-medium text-accent">
          {strings.review.fromAi}
        </span>
        {note.labels.map((name) => (
          <LabelBadge key={name} name={name} color={labelColor(labels, name)} />
        ))}
      </div>
      <h2 className="mt-3 text-[15px] leading-snug font-semibold break-words text-fg">
        {note.title === '' ? strings.note.untitled : note.title}
      </h2>
      {note.body.trim() !== '' && (
        <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-fg-secondary">
          {note.body.trim()}
        </p>
      )}
      <p className="mt-3 font-mono text-xs text-fg-muted">{meta.join(' · ')}</p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            actions.acceptReview([note.id])
          }}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control bg-panel px-4 text-[15px] font-semibold text-fg hover:bg-page"
        >
          {strings.review.accept}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            actions.deleteNote(note.id)
          }}
          className={secondaryButtonClass}
        >
          {strings.review.delete}
        </button>
      </div>
    </article>
  )
}
