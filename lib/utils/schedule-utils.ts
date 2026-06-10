export interface ScheduleSlot {
  label: string  // "HH:MM" in Europe/London
  value: string  // UTC ISO string sent to API
}

/**
 * Generate 15-min slots from [now + 30 min] to storeClose ("HH:MM").
 * If earliest crosses today's close, rolls to tomorrow at storeOpen.
 */
export function generateScheduleSlots(
  now: Date = new Date(),
  storeOpen = '11:00',
  storeClose = '22:00',
): ScheduleSlot[] {
  const [openH, openM] = storeOpen.split(':').map(Number)
  const [closeH, closeM] = storeClose.split(':').map(Number)
  const slots: ScheduleSlot[] = []

  const earliest = new Date(now.getTime() + 30 * 60 * 1000)
  const minRemainder = earliest.getMinutes() % 15
  if (minRemainder !== 0) {
    earliest.setMinutes(earliest.getMinutes() + (15 - minRemainder), 0, 0)
  } else {
    earliest.setSeconds(0, 0)
  }

  const closeTime = new Date(now)
  closeTime.setHours(closeH, closeM, 0, 0)

  if (earliest >= closeTime) {
    const tomorrowOpen = new Date(now)
    tomorrowOpen.setDate(tomorrowOpen.getDate() + 1)
    tomorrowOpen.setHours(openH, openM, 0, 0)
    earliest.setTime(tomorrowOpen.getTime())
    closeTime.setDate(closeTime.getDate() + 1)
  }

  const cursor = new Date(earliest)
  while (cursor < closeTime) {
    slots.push({
      label: cursor.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }),
      value: cursor.toISOString(),
    })
    cursor.setMinutes(cursor.getMinutes() + 15)
  }

  return slots
}

/** True if scheduled_for is more than 30 min from now (KDS future queue). */
export function isInFutureQueue(scheduledFor: string | null, now: Date): boolean {
  if (!scheduledFor) return false
  return new Date(scheduledFor).getTime() > now.getTime() + 30 * 60 * 1000
}

/**
 * Server-side validation for a UTC ISO scheduled_for string.
 * Checks: valid date, future, within store hours (Europe/London).
 * storeOpen/storeClose are "HH:MM" strings for the target day.
 */
export function validateScheduledFor(
  isoUtc: string,
  now: Date = new Date(),
  storeOpen = '11:00',
  storeClose = '22:00',
): { valid: boolean; error?: string } {
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
  if (!ISO_RE.test(isoUtc)) {
    return { valid: false, error: 'Invalid scheduled time' }
  }

  const scheduled = new Date(isoUtc)

  if (scheduled <= now) {
    return { valid: false, error: 'Scheduled time must be in the future' }
  }

  if (scheduled.getTime() < now.getTime() + 30 * 60 * 1000) {
    return { valid: false, error: 'Scheduled time must be at least 30 minutes from now' }
  }

  if (scheduled.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000) {
    return { valid: false, error: 'Cannot schedule more than 7 days in advance' }
  }

  const [openH, openM] = storeOpen.split(':').map(Number)
  const [closeH, closeM] = storeClose.split(':').map(Number)
  const openTotalMins  = openH  * 60 + openM
  const closeTotalMins = closeH * 60 + closeM

  // Extract UK hour + minute (hourCycle:'h23' avoids V8 midnight '24' bug)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(scheduled)
  const ukHour = parseInt(parts.find((p) => p.type === 'hour')?.value   ?? '0', 10)
  const ukMin  = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const ukTotalMins = ukHour * 60 + ukMin

  if (ukTotalMins < openTotalMins) {
    return { valid: false, error: `Scheduled time is before opening hours (${storeOpen})` }
  }
  if (ukTotalMins >= closeTotalMins) {
    return { valid: false, error: `Scheduled time is after closing hours (${storeClose})` }
  }

  return { valid: true }
}

