// Local calendar-day key (YYYY-MM-DD) using the browser's local timezone.
// Never use date.toISOString() for this: it converts to UTC first, which
// flips the date to the next (or previous) day whenever the local timezone
// offset pushes the instant across midnight in UTC.
export function toDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
