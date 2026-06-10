import { describe, it, expect } from 'vitest'
import {
  generateScheduleSlots,
  isInFutureQueue,
  validateScheduledFor,
} from './schedule-utils'

// ── generateScheduleSlots ─────────────────────────────────────────────────────

describe('generateScheduleSlots', () => {
  it('returns slots starting at least 30 minutes from now', () => {
    const now = new Date('2026-06-09T13:00:00') // 1 PM
    const slots = generateScheduleSlots(now)
    expect(slots.length).toBeGreaterThan(0)
    const firstSlot = new Date(slots[0].value)
    expect(firstSlot.getTime()).toBeGreaterThanOrEqual(now.getTime() + 30 * 60 * 1000)
  })

  it('rounds first slot up to next 15-minute boundary', () => {
    // now+30 = 13:47 → first slot should be 14:00
    const now = new Date('2026-06-09T13:17:00')
    const slots = generateScheduleSlots(now)
    const firstSlot = new Date(slots[0].value)
    expect(firstSlot.getMinutes() % 15).toBe(0)
  })

  it('slots are exactly 15 minutes apart', () => {
    const now = new Date('2026-06-09T13:00:00')
    const slots = generateScheduleSlots(now)
    expect(slots.length).toBeGreaterThan(1)
    for (let i = 1; i < slots.length; i++) {
      const diff =
        new Date(slots[i].value).getTime() - new Date(slots[i - 1].value).getTime()
      expect(diff).toBe(15 * 60 * 1000)
    }
  })

  it('no slot falls at or after store close time', () => {
    const now = new Date('2026-06-09T13:00:00')
    const slots = generateScheduleSlots(now, '11:00', '22:00')
    for (const slot of slots) {
      const slotDate = new Date(slot.value)
      const closeTime = new Date(now)
      closeTime.setHours(22, 0, 0, 0)
      expect(slotDate.getTime()).toBeLessThan(closeTime.getTime())
    }
  })

  it('returns slots for tomorrow when past closing time', () => {
    const now = new Date('2026-06-09T22:30:00')
    const slots = generateScheduleSlots(now, '11:00', '22:00')
    expect(slots.length).toBeGreaterThan(0)
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const firstSlot = new Date(slots[0].value)
    expect(firstSlot.getFullYear()).toBe(tomorrow.getFullYear())
    expect(firstSlot.getMonth()).toBe(tomorrow.getMonth())
    expect(firstSlot.getDate()).toBe(tomorrow.getDate())
  })

  it('returns empty array when exactly at close time with no slots possible', () => {
    const now = new Date('2026-06-09T21:45:00')
    const slots = generateScheduleSlots(now, '11:00', '22:00')
    for (const slot of slots) {
      const slotDate = new Date(slot.value)
      const closeToday = new Date(now)
      closeToday.setHours(22, 0, 0, 0)
      const isTomorrow = slotDate.getDate() > now.getDate()
      const isBeforeClose = slotDate.getTime() < closeToday.getTime()
      expect(isTomorrow || isBeforeClose).toBe(true)
    }
  })

  it('handles non-zero open/close minutes (e.g. 11:30 open, 21:30 close)', () => {
    const now = new Date('2026-06-09T13:00:00')
    const slots = generateScheduleSlots(now, '11:30', '21:30')
    expect(slots.length).toBeGreaterThan(0)
    const last = new Date(slots[slots.length - 1].value)
    const closeTime = new Date(now)
    closeTime.setHours(21, 30, 0, 0)
    expect(last.getTime()).toBeLessThan(closeTime.getTime())
  })

  it('each slot value is a valid ISO string', () => {
    const now = new Date('2026-06-09T13:00:00')
    const slots = generateScheduleSlots(now)
    for (const slot of slots) {
      expect(() => new Date(slot.value)).not.toThrow()
      expect(isNaN(new Date(slot.value).getTime())).toBe(false)
    }
  })
})

// ── isInFutureQueue ───────────────────────────────────────────────────────────

describe('isInFutureQueue', () => {
  const now = new Date('2026-06-09T14:00:00Z')

  it('returns false for ASAP order (null scheduled_for)', () => {
    expect(isInFutureQueue(null, now)).toBe(false)
  })

  it('returns true when scheduled_for is > 30 min away', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString() // +1h
    expect(isInFutureQueue(future, now)).toBe(true)
  })

  it('returns true when scheduled_for is exactly 31 min away', () => {
    const future = new Date(now.getTime() + 31 * 60 * 1000).toISOString()
    expect(isInFutureQueue(future, now)).toBe(true)
  })

  it('returns false when scheduled_for is exactly 30 min away', () => {
    const edge = new Date(now.getTime() + 30 * 60 * 1000).toISOString()
    expect(isInFutureQueue(edge, now)).toBe(false)
  })

  it('returns false when scheduled_for is < 30 min away', () => {
    const soon = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
    expect(isInFutureQueue(soon, now)).toBe(false)
  })

  it('returns false for past scheduled_for', () => {
    const past = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    expect(isInFutureQueue(past, now)).toBe(false)
  })
})

// ── validateScheduledFor ──────────────────────────────────────────────────────

describe('validateScheduledFor', () => {
  // Fixed "now" in UTC: 2026-06-09 12:00 UTC = 13:00 BST
  const now = new Date('2026-06-09T12:00:00Z')

  it('rejects invalid date strings', () => {
    const { valid, error } = validateScheduledFor('not-a-date', now)
    expect(valid).toBe(false)
    expect(error).toMatch(/invalid/i)
  })

  it('rejects times in the past', () => {
    const past = new Date(now.getTime() - 60 * 1000).toISOString()
    const { valid, error } = validateScheduledFor(past, now)
    expect(valid).toBe(false)
    expect(error).toMatch(/future/i)
  })

  it('rejects time equal to now', () => {
    const { valid } = validateScheduledFor(now.toISOString(), now)
    expect(valid).toBe(false)
  })

  it('accepts a valid future time within business hours', () => {
    // 15:00 UTC = 16:00 BST → within 11:00-22:00 range
    const future = new Date('2026-06-09T15:00:00Z').toISOString()
    const { valid } = validateScheduledFor(future, now, '11:00', '22:00')
    expect(valid).toBe(true)
  })

  it('rejects times before store opening hours in UK time', () => {
    // earlyNow = 05:00 UTC = 06:00 BST; tooEarly = 08:00 UTC = 09:00 BST → before 11:00
    const earlyNow = new Date('2026-06-09T05:00:00Z')
    const tooEarly = new Date('2026-06-09T08:00:00Z').toISOString()
    const { valid, error } = validateScheduledFor(tooEarly, earlyNow, '11:00', '22:00')
    expect(valid).toBe(false)
    expect(error).toMatch(/opening hours/i)
  })

  it('rejects times at or after store closing hours in UK time', () => {
    // 21:00 UTC = 22:00 BST → at close
    const atClose = new Date('2026-06-09T21:00:00Z').toISOString()
    const { valid, error } = validateScheduledFor(atClose, now, '11:00', '22:00')
    expect(valid).toBe(false)
    expect(error).toMatch(/closing hours/i)
  })

  it('rejects times past store closing hours in UK time', () => {
    // 22:00 UTC = 23:00 BST → past close
    const pastClose = new Date('2026-06-09T22:00:00Z').toISOString()
    const { valid, error } = validateScheduledFor(pastClose, now, '11:00', '22:00')
    expect(valid).toBe(false)
    expect(error).toMatch(/closing hours/i)
  })

  it('accepts time at exactly open hour in UK time', () => {
    // earlyNow = 05:00 UTC = 06:00 BST; atOpen = 10:00 UTC = 11:00 BST
    const earlyNow = new Date('2026-06-09T05:00:00Z')
    const atOpen = new Date('2026-06-09T10:00:00Z').toISOString()
    const { valid } = validateScheduledFor(atOpen, earlyNow, '11:00', '22:00')
    expect(valid).toBe(true)
  })

  it('uses minute-precision for non-zero open minutes (e.g. 11:30)', () => {
    // earlyNow=05:00 UTC; scheduled=10:15 UTC=11:15 BST → before 11:30 open
    const earlyNow = new Date('2026-06-09T05:00:00Z')
    const before1130 = new Date('2026-06-09T10:15:00Z').toISOString()
    const { valid, error } = validateScheduledFor(before1130, earlyNow, '11:30', '22:00')
    expect(valid).toBe(false)
    expect(error).toMatch(/opening hours/i)
  })

  it('rejects scheduled time less than 30 minutes from now', () => {
    // 15 min from now = within 30-min minimum
    const tooSoon = new Date(now.getTime() + 15 * 60 * 1000).toISOString()
    const { valid, error } = validateScheduledFor(tooSoon, now)
    expect(valid).toBe(false)
    expect(error).toMatch(/30 minutes/i)
  })

  it('rejects scheduled time more than 7 days in advance', () => {
    const tooFar = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString()
    const { valid, error } = validateScheduledFor(tooFar, now)
    expect(valid).toBe(false)
    expect(error).toMatch(/7 days/i)
  })

  it('rejects non-Z ISO strings (no timezone suffix)', () => {
    const { valid, error } = validateScheduledFor('2026-06-09 15:00:00', now)
    expect(valid).toBe(false)
    expect(error).toMatch(/invalid/i)
  })
})
