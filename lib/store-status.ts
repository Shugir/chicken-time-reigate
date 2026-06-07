export const DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const
export type DayKey = (typeof DAYS)[number]

export interface DayHours {
  enabled: boolean
  open:    string  // "HH:MM"
  close:   string  // "HH:MM"
}

export type BusinessHours = Record<DayKey, DayHours>

export interface Holiday {
  date: string   // "YYYY-MM-DD"
  note?: string
}

export interface StoreStatusResult {
  isOpen:      boolean
  reason:      string
  closedUntil: string | null
}

export function getUKNow() {
  const tz  = 'Europe/London'
  const now = new Date()

  const weekday = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' }).toLowerCase() as DayKey
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: tz }) // YYYY-MM-DD

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const h = String(parts.find(p => p.type === 'hour')?.value ?? 0).padStart(2, '0')
  const m = parts.find(p => p.type === 'minute')?.value ?? '00'

  return { weekday, dateStr, timeStr: `${h}:${m}`, now }
}

export function checkStoreStatus(
  isAcceptingOrders: boolean,
  businessHours: BusinessHours | null,
  holidays: Holiday[] | null,
): StoreStatusResult {
  if (!isAcceptingOrders) {
    return { isOpen: false, reason: 'Store is temporarily closed', closedUntil: null }
  }

  const { weekday, dateStr, timeStr } = getUKNow()

  // Holiday check
  const holiday = holidays?.find(h => h.date === dateStr)
  if (holiday) {
    return { isOpen: false, reason: `Closed: ${holiday.note ?? 'holiday'}`, closedUntil: null }
  }

  if (!businessHours) return { isOpen: true, reason: '', closedUntil: null }

  const dayHours = businessHours[weekday]

  if (!dayHours?.enabled) {
    const next = getNextOpenDay(businessHours, weekday)
    return {
      isOpen:      false,
      reason:      'Closed today',
      closedUntil: next ? `Opening ${next.day} at ${next.open}` : null,
    }
  }

  if (timeStr < dayHours.open) {
    return { isOpen: false, reason: 'Not open yet', closedUntil: `Opening today at ${dayHours.open}` }
  }

  if (timeStr >= dayHours.close) {
    const next = getNextOpenDay(businessHours, weekday)
    return {
      isOpen:      false,
      reason:      'Closed for today',
      closedUntil: next ? `Opening ${next.day} at ${next.open}` : null,
    }
  }

  return { isOpen: true, reason: '', closedUntil: null }
}

function getNextOpenDay(
  hours: BusinessHours,
  currentDay: DayKey,
): { day: string; open: string } | null {
  const idx = DAYS.indexOf(currentDay)
  for (let i = 1; i <= 7; i++) {
    const nextDay = DAYS[(idx + i) % 7]
    const h = hours[nextDay]
    if (h?.enabled) {
      return {
        day:  nextDay.charAt(0).toUpperCase() + nextDay.slice(1),
        open: h.open,
      }
    }
  }
  return null
}
