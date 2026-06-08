import { describe, it, expect, vi, afterEach } from 'vitest'
import { orderUrgency } from './order-urgency'

describe('orderUrgency', () => {
  afterEach(() => { vi.useRealTimers() })

  function isoMinutesAgo(mins: number) {
    return new Date(Date.now() - mins * 60000).toISOString()
  }

  it('returns normal for orders under 15 minutes old', () => {
    expect(orderUrgency(isoMinutesAgo(5))).toBe('normal')
    expect(orderUrgency(isoMinutesAgo(14))).toBe('normal')
  })

  it('returns warning for orders 15–29 minutes old', () => {
    expect(orderUrgency(isoMinutesAgo(15))).toBe('warning')
    expect(orderUrgency(isoMinutesAgo(29))).toBe('warning')
  })

  it('returns critical for orders 30 minutes or older', () => {
    expect(orderUrgency(isoMinutesAgo(30))).toBe('critical')
    expect(orderUrgency(isoMinutesAgo(60))).toBe('critical')
  })
})
