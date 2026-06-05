type DateInput = string | Date

function d(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input)
}

/** DD/MM/YYYY */
export function formatDate(input: DateInput): string {
  return d(input).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/** HH:MM (24-hour) */
export function formatTime(input: DateInput): string {
  return d(input).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

/** HH:MM:SS (24-hour) */
export function formatTimeFull(input: DateInput): string {
  return d(input).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/** DD/MM/YYYY HH:MM */
export function formatDateTime(input: DateInput): string {
  return `${formatDate(input)} ${formatTime(input)}`
}

/** "5 Jun" — compact label for chart axes */
export function formatDateShort(input: DateInput): string {
  return d(input).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
  })
}

/** "Thu, 5 Jun 2025" — receipts and ledger headers */
export function formatDateMedium(input: DateInput): string {
  return d(input).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** "Thursday, 5 June 2025" — admin page section headers */
export function formatDateHeader(input: DateInput): string {
  return d(input).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** "Thu, 5 Jun" — kitchen clock date strip (no year) */
export function formatDateClockLabel(input: DateInput): string {
  return d(input).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
