import { useEffect, useState, type RefCallback } from 'react'

/**
 * Picks the placeholder that fits the field: the full text while there is room
 * for it, the short one otherwise. A placeholder never wraps, so a long hint is
 * simply cut off in a narrow field.
 *
 * The decision follows the width of the field itself, not of the window: with
 * the sidebar open the field on a tablet is narrower than on a large phone.
 *
 * Returns the text and a callback to pass to the field as its `ref`.
 */
export function useFittingPlaceholder(
  full: string,
  short: string,
): [placeholder: string, attach: RefCallback<HTMLInputElement>] {
  // The field is kept in state, not in a ref object, so that the effect runs once it is mounted.
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [fits, setFits] = useState(true)

  useEffect(() => {
    // Without layout (tests, very old browsers) there is nothing to measure: keep the full text.
    if (!input || typeof ResizeObserver === 'undefined') return

    const context = document.createElement('canvas').getContext('2d')
    if (!context) return

    const measure = () => {
      const style = getComputedStyle(input)
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const room =
        input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setFits(context.measureText(full).width <= room)
    }

    // The observer reports the size right after `observe` and on every later change.
    const observer = new ResizeObserver(measure)
    observer.observe(input)

    // The text is wider or narrower until the web font arrives, so measure again then.
    let active = true
    void document.fonts.ready.then(() => {
      if (active) measure()
    })

    return () => {
      active = false
      observer.disconnect()
    }
  }, [input, full])

  return [fits ? full : short, setInput]
}
