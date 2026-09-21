import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escape-html'

describe('escapeHtml', () => {
  it('escapes & < > " and \'', () => {
    expect(escapeHtml(`<img src=x onerror="a('b')">&`)).toBe(
      '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;'
    )
  })

  it('escapes ampersand first so entities are not double-escaped', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('returns empty string for null and undefined', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('leaves plain text alone', () => {
    expect(escapeHtml('Nashville ×2, Coke')).toBe('Nashville ×2, Coke')
  })
})
