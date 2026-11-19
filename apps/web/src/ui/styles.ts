// Shared class lists for form controls, so that every button and field looks the same.

export const fieldClass =
  'w-full rounded-control border border-line bg-page px-3 py-2.5 text-[15px] text-fg placeholder:text-fg-muted'

export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-5 text-[15px] font-semibold text-on-accent hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'

export const secondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-panel px-4 text-[15px] font-semibold text-fg hover:bg-card'

export const dangerButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-panel px-4 text-[15px] font-semibold text-tag-red hover:bg-card'

export const iconButtonClass =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-secondary hover:bg-card hover:text-fg'

export const sectionTitleClass =
  'px-3 font-mono text-[11px] font-medium tracking-[0.12em] text-fg-muted uppercase'

/**
 * Widens the area that takes taps to at least 44 × 44 px without changing how a
 * small control looks: an invisible box centred on it.
 */
export const touchTargetClass =
  "relative after:absolute after:top-1/2 after:left-1/2 after:size-11 after:min-h-full after:min-w-full after:-translate-1/2 after:content-['']"
