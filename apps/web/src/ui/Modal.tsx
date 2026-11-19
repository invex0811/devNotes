import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  /** Accessible name of the dialog. */
  label: string
  onClose: () => void
  children: ReactNode
  /** Width class, e.g. `max-w-3xl`. */
  widthClass?: string
}

/**
 * Modal dialog on the native <dialog>: the browser traps focus inside,
 * closes it on Esc and makes the rest of the page inert.
 */
export function Modal({ label, onClose, children, widthClass = 'max-w-md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // A click on the dimmed area lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose()
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] ${widthClass} overflow-y-auto rounded-dialog border border-line bg-panel p-0 text-fg backdrop:bg-backdrop/80`}
    >
      {children}
    </dialog>
  )
}
