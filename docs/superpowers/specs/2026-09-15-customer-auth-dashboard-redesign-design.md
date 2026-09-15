# Customer Auth + Dashboard Redesign

Date: 2026-09-15
Status: Approved, pending implementation plan

## Context

Four auth pages exist doing the same job: `/login`, `/sign-in`, `/signup`,
`/sign-up`. `/sign-in` and `/sign-up` are the newer, richer implementations
(OAuth buttons, split-panel light layout, role-based post-login redirect).
`/login` and `/signup` are older, simpler, dark-themed versions.
`middleware.ts` and `app/account/page.tsx` currently redirect unauthenticated
users to `/login`, while `components/SiteHeader.tsx` links to `/sign-in` and
`/sign-up` — a customer bounced from a protected route lands on a visually
and functionally different page than the one linked from the header.

The customer dashboard (`app/account/page.tsx`) is already functionally
broad — Active Orders, History (reorder, print receipt), Offers, Rewards
(links to `/account/rewards`), Profile edit, Security (password reset,
close account), Sign Out — but has real bugs and needs an Apple-standard
visual pass. The customer asked for a light/dark theme the customer can
switch between; the existing dark theme (`/login`, `/signup`) and light
theme (`/sign-in`, `/sign-up`) already give both palettes a proven
reference, so no from-scratch design work.

Separately, a live RLS security leak (permissive `USING (true)` policies on
`orders`/`order_items` from `20260612_kitchen_rls.sql`) was found and fixed
already, out of band (commit `fcf3ca4`) — not part of this spec.

## Goals

1. Collapse four auth pages to two canonical routes: `/sign-in`, `/sign-up`.
2. Add a light/dark theme toggle, scoped to auth + dashboard pages, persisted
   per browser, defaulting to system preference.
3. Fix known dashboard bugs (stale header auth state, sign-out state refresh).
4. Apply Apple-standard visual polish to the existing dashboard tab
   structure, in both themes — no new tabs or features.
5. Make the full journey (browse → sign up → sign in → use dashboard → sign
   out) consistent and glitch-free end to end.

## Non-goals

- No new dashboard functionality (no new tabs, no feature additions beyond
  the theme toggle itself).
- No site-wide theme toggle — scoped to auth + `/account*` only; rest of the
  site stays dark-only as today.
- No new npm dependency for theming.
- No further DB/RLS work (handled separately, already shipped).

## Design

### 1. Route consolidation

- Delete `app/login/page.tsx` and `app/signup/page.tsx`.
- `/login`'s one unique behavior — fetching the store's uploaded logo via
  `/api/admin/store-settings` for display — is folded into the canonical
  `/sign-in` page.
- Add redirects in `next.config.ts`:
  ```ts
  async redirects() {
    return [
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/signup', destination: '/sign-up', permanent: true },
    ]
  }
  ```
- Update `middleware.ts`: redirect target `/login` → `/sign-in`.
- Update `app/account/page.tsx`: auth-check redirect and `handleSignOut`
  target `/login` → `/sign-in`.
- Grep the repo for any other `/login` or `/signup` literal references
  (e.g. `app/api/auth/role` callers, emails) and update those too.

### 2. Theme toggle

- New `lib/theme.tsx`: a small client-side `ThemeProvider` (React context)
  + `useTheme()` hook exposing `{ theme: 'light' | 'dark', toggle: () => void }`.
  Persists to `localStorage` under `theme`; defaults to
  `window.matchMedia('(prefers-color-scheme: dark)')` when unset.
- Toggling sets/removes the `dark` class on `document.documentElement`.
- `app/layout.tsx`: add an inline blocking `<script>` in `<head>` that reads
  `localStorage.theme` (falling back to system preference) and sets the
  `dark`/no-class state on `<html>` before first paint, avoiding a
  flash-of-wrong-theme. Wrap children in `ThemeProvider` (global wrap is
  simplest — only components that use `dark:` variants are visually
  affected, and only auth/dashboard pages will).
- New `components/ThemeToggle.tsx`: small sun/moon icon button using
  `useTheme()`. Placed in the auth pages' header area and the dashboard's
  sticky header, next to Sign Out.
- Tailwind already has `@theme` tokens for `brand-dark` (#1A1A1A) and
  `brand-light` (#F8F9FA) in `app/globals.css` — reuse these as the base
  surface colors for each theme rather than introducing new ones.

### 3. Dashboard bug fixes

- **Stale header auth state**: `components/SiteHeader.tsx` currently checks
  `supabase.auth.getSession()` once on mount. Add a
  `supabase.auth.onAuthStateChange((event) => ...)` listener so
  `isLoggedIn`/`loyaltyPoints` update reactively on `SIGNED_IN` /
  `SIGNED_OUT`, without requiring a hard refresh.
- **Sign-out state refresh**: `app/account/page.tsx`'s `handleSignOut` and
  the new `/sign-in` page's post-login flow should call `router.refresh()`
  after `router.push(...)` so server-rendered/cached state (if any) is
  consistent with the new auth state. (Client-side, the `onAuthStateChange`
  listener above is the primary fix; `router.refresh()` is a supporting
  belt-and-braces step.)

### 4. Visual redesign (Apple-standard, both themes)

Applied to the existing structure of `/sign-in`, `/sign-up`,
`app/account/page.tsx`, and `app/account/rewards/page.tsx` — tabs, fields,
and flows unchanged, execution upgraded:

- System-ui/SF-Pro-style type scale (the app already uses `font-heading` /
  Inter — keep it, just tune weight/size/spacing).
- Larger, softer corners (`rounded-2xl`/`rounded-3xl`), subtle shadows
  instead of hard 1px borders where it reads as a "card."
- Skeleton loaders (simple pulsing placeholder blocks matching final
  content shape) replacing bare spinner-only loading states.
- Tap-scale micro-interaction (`active:scale-[0.98]` or similar) on primary
  buttons and interactive cards.
- Smoother tab-switch transition (fade/slide, not an instant swap).
- Both themes styled from the existing references: dark ≈ current
  `/login`/`/signup` card aesthetic (zinc-950/900 surfaces), light ≈
  current `/sign-in`/`/sign-up` split-panel aesthetic (white surfaces,
  `brand-dark` text).

## Files touched

- `lib/theme.tsx` (new)
- `components/ThemeToggle.tsx` (new)
- `app/layout.tsx` (blocking script, `ThemeProvider` wrap)
- `app/sign-in/page.tsx` (rewrite: both themes, folded-in logo fetch)
- `app/sign-up/page.tsx` (rewrite: both themes)
- `app/login/page.tsx` (delete)
- `app/signup/page.tsx` (delete)
- `next.config.ts` (redirects)
- `middleware.ts` (redirect target)
- `app/account/page.tsx` (bug fixes + redesign, both themes)
- `app/account/rewards/page.tsx` (redesign, both themes)
- `components/SiteHeader.tsx` (auth-state-change listener)

## Testing

- Manual flow walkthrough in the browser (per this project's `run` skill):
  sign up → confirm-email screen → sign in → dashboard tabs (active order
  visible if one exists, history, offers, rewards link, profile save,
  password reset, close-account confirm dialog) → sign out → back to public
  site, header reflects logged-out state without refresh.
- Repeat the walkthrough with the theme toggled to the other mode partway
  through, confirming the choice persists across the sign-in → dashboard →
  sign-out navigation.
- `npx tsc --noEmit` clean.
- Old `/login` and `/signup` URLs redirect correctly.

## Open questions

None outstanding — all sections above were reviewed and approved in chat
before this document was written.
