import { strings } from '../../i18n'

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** "сегодня", "вчера", "12 ноя", and with the year for other years: "3 ноя 2025". */
export function formatNoteDate(iso: string, now: Date): string {
  const date = new Date(iso)
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000)
  if (days === 0) return strings.date.today
  if (days === 1) return strings.date.yesterday
  const month = strings.date.months[date.getMonth()] ?? ''
  const base = `${date.getDate()} ${month}`
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`
}
