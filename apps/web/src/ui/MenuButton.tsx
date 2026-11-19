import { MoreVertical } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { iconButtonClass } from './styles'

export interface MenuItem {
  label: string
  icon: ReactNode
  onSelect: () => void
}

/**
 * A "⋯" button with a small menu: Escape or a click outside closes it, arrows
 * move between items, the first item gets focus when it opens.
 */
export function MenuButton({ label, items }: { label: string; items: readonly MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const menu = root.current?.querySelector<HTMLElement>('[role="menuitem"]')
    menu?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false)
      root.current?.querySelector<HTMLElement>('button')?.focus()
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const entries = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = entries.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    entries[(index + step + entries.length) % entries.length]?.focus()
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          setOpen(!open)
        }}
        className={iconButtonClass}
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute top-full right-0 z-30 mt-1 min-w-60 rounded-card border border-line bg-panel p-1.5 shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-left text-[15px] text-fg hover:bg-card focus-visible:bg-card"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
