/**
 * Returns `next` only when it is a same-origin relative path ("/order/..."), else null.
 * Rejects protocol-relative ("//evil.com"), backslash ("/\evil.com" — browsers treat
 * "\" as "/"), absolute and scheme URLs, and control characters that browsers strip.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (typeof next !== 'string' || !next.startsWith('/')) return null
  if (next.startsWith('//') || next.startsWith('/\\')) return null
  if (/[\u0000-\u001f\u007f]/.test(next)) return null
  return next
}

/** `path` with the safe `next` from a query string (e.g. `window.location.search`) carried over, else `path` alone. */
export function withNext(path: string, search: string): string {
  const next = safeNextPath(new URLSearchParams(search).get('next'))
  return next ? `${path}?next=${encodeURIComponent(next)}` : path
}
