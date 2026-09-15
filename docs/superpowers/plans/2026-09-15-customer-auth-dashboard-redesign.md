# Customer Auth + Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the four duplicate auth pages to two (`/sign-in`, `/sign-up`), add a light/dark theme toggle scoped to auth + dashboard pages, fix two known dashboard bugs, and apply an Apple-standard visual pass to the existing dashboard structure — in both themes, with no new functionality beyond the toggle itself.

**Architecture:** A hand-rolled theme system (pure resolver function + React context + a pre-paint blocking script) drives Tailwind's `dark:` variant, repointed from the default `prefers-color-scheme` media query to a `.dark` class on `<html>` via `@custom-variant`. Auth pages and the dashboard get restyled in place using that variant; no new dependency, no new dashboard features, no change to the rest of the (already dark-only) site.

**Tech Stack:** Next.js 16 (App Router, Turbopack), Tailwind CSS v4, Supabase (`@supabase/ssr`), React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-customer-auth-dashboard-redesign-design.md`

## Global Constraints

- No new npm dependency for theming (hand-rolled context + `localStorage`, no `next-themes`).
- Theme toggle scoped to `/sign-in`, `/sign-up`, `/account`, `/account/rewards` only — rest of the site stays dark-only, untouched.
- No new dashboard tabs or features. Existing tab structure (Active/History/Offers/Rewards/Profile/Security) is unchanged.
- Delete `/login` and `/signup`; every reference to those paths in the app must be updated to `/sign-in`/`/sign-up`, plus a permanent redirect for old links.
- Dark theme reference: current `/login`/`/signup` (zinc-950/900 surfaces). Light theme reference: current `/sign-in`/`/sign-up` (white surfaces, `brand-dark` text). Reuse these palettes; don't invent new ones.
- `npx tsc --noEmit` must stay clean after every task.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/globals.css` | modify | Add `@custom-variant dark` so `dark:` responds to a class, not OS preference |
| `lib/theme.ts` | new | Pure, unit-testable theme-resolution logic (no DOM/React) |
| `lib/theme-context.tsx` | new | `ThemeProvider` + `useTheme()` React context, wraps `lib/theme.ts` |
| `components/ThemeToggle.tsx` | new | Sun/moon icon button, calls `useTheme().toggle` |
| `app/layout.tsx` | modify | Blocking pre-paint script + wrap children in `ThemeProvider` |
| `next.config.ts` | modify | Permanent redirects `/login` → `/sign-in`, `/signup` → `/sign-up` |
| `middleware.ts` | modify | Redirect target `/login` → `/sign-in` |
| `app/login/page.tsx` | delete | Superseded by `/sign-in` |
| `app/signup/page.tsx` | delete | Superseded by `/sign-up` |
| `app/sign-in/page.tsx` | modify | Both-theme styling, `ThemeToggle`, folded-in dynamic logo fetch |
| `app/sign-up/page.tsx` | modify | Both-theme styling, `ThemeToggle` |
| `components/SiteHeader.tsx` | modify | Fix stale auth state (add `onAuthStateChange` listener) |
| `app/account/page.tsx` | modify | Redirect-target fix, `router.refresh()` on sign-out, skeleton loaders, both-theme styling, `ThemeToggle`, tap-scale micro-interaction |
| `app/account/rewards/page.tsx` | modify | Redirect-target fix, both-theme styling |

---

## Task 1: Theme system core

**Files:**
- Modify: `app/globals.css`
- Create: `lib/theme.ts`
- Test: `lib/theme.test.ts`
- Create: `lib/theme-context.tsx`
- Create: `components/ThemeToggle.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: `resolveTheme(stored: string | null, prefersDark: boolean): 'light' | 'dark'` from `lib/theme.ts`
- Produces: `THEME_STORAGE_KEY = 'theme'` constant from `lib/theme.ts`
- Produces: `ThemeProvider` (React component), `useTheme(): { theme: 'light' | 'dark', toggle: () => void }` from `lib/theme-context.tsx`
- Produces: `ThemeToggle` (React component, no props) from `components/ThemeToggle.tsx`

- [ ] **Step 1: Add the class-based dark variant to Tailwind**

Tailwind v4's `dark:` variant defaults to `@media (prefers-color-scheme: dark)`. To drive it from a `.dark` class on `<html>` instead (so the toggle actually controls it), add this near the top of `app/globals.css`, right after the `@import "tailwindcss";` line:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

- [ ] **Step 2: Write the failing test for the pure resolver**

Create `lib/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('uses the stored value when present, ignoring system preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('falls back to system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })

  it('falls back to system preference when the stored value is garbage', () => {
    expect(resolveTheme('sepia', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/theme.test.ts`
Expected: FAIL — `Cannot find module './theme'` (file doesn't exist yet).

- [ ] **Step 4: Write the pure resolver**

Create `lib/theme.ts`:

```ts
export const THEME_STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark'

export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/theme.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write the React context wrapping the resolver**

Create `lib/theme-context.tsx`:

```tsx
'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from './theme'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(resolveTheme(stored, prefersDark))
  }, [])

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  function toggle() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
```

- [ ] **Step 7: Write the toggle button component**

Create `components/ThemeToggle.tsx`:

```tsx
'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme-context'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-9 h-9 flex items-center justify-center rounded-full transition-colors
                 text-zinc-500 hover:text-zinc-300 hover:bg-white/5
                 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/5"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
```

(Note: this button's own colors are theme-aware on purpose — Tasks 3/4/6/7 place it on both light- and dark-background headers, so it needs to read correctly against either. The exact classes get finalized per placement in those tasks; this is the reusable default.)

- [ ] **Step 8: Wire the blocking script and provider into the root layout**

Modify `app/layout.tsx` — add the inline blocking script as the first child of `<head>`-equivalent (Next's App Router has no explicit `<head>` tag in `RootLayout`'s JSX for this project; add a `<head>` element directly, which Next merges with its own), and wrap `<SiteChrome>` in `ThemeProvider`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SiteChrome } from "@/components/SiteChrome";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "@/lib/theme-context";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Chicken Time Reigate",
  description: "Fresh, crispy chicken delivered fast in Reigate. Order burgers, wings, sides and drinks.",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = (stored === 'light' || stored === 'dark') ? stored : (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-white text-brand-dark" suppressHydrationWarning>

        <ThemeProvider>
          <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

          <SiteChrome>{children}</SiteChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Verify no flash-of-wrong-theme and toggle works**

Run: `npm run dev` (if not already running), then in Chrome:
1. `localStorage.setItem('theme', 'dark')` in devtools console, reload any page — `document.documentElement.classList` should contain `dark` before any content paints (no flash).
2. `localStorage.setItem('theme', 'light')`, reload — no `dark` class.
3. Clear `localStorage.theme`, reload — matches OS `prefers-color-scheme`.

(No visual difference yet anywhere in the app — no page uses `dark:` variants until Tasks 3/4/6/7. This step only confirms the class is being set/toggled correctly; use devtools to inspect `<html>`'s class list.)

- [ ] **Step 10: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add app/globals.css lib/theme.ts lib/theme.test.ts lib/theme-context.tsx components/ThemeToggle.tsx app/layout.tsx
git commit -m "feat: add hand-rolled light/dark theme toggle system"
```

---

## Task 2: Route consolidation

**Files:**
- Delete: `app/login/page.tsx`
- Delete: `app/signup/page.tsx`
- Modify: `next.config.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: none
- Produces: `/login` and `/signup` now 308-redirect to `/sign-in`/`/sign-up`; `middleware.ts`'s unauthenticated redirect target is `/sign-in`

- [ ] **Step 1: Delete the duplicate pages**

```bash
git rm app/login/page.tsx app/signup/page.tsx
```

- [ ] **Step 2: Add redirects in next.config.ts**

Modify `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async redirects() {
    return [
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/signup', destination: '/sign-up', permanent: true },
    ]
  },
};

export default nextConfig;
```

- [ ] **Step 3: Repoint middleware's redirect target**

In `middleware.ts`, change:

```ts
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
```

to:

```ts
  if (!user) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
```

- [ ] **Step 4: Find every remaining reference to the old paths**

Run: `grep -rn "'/login'\|\"/login\"\|'/signup'\|\"/signup\"" app components lib --include="*.tsx" --include="*.ts"`

Expected matches at this point: `app/account/page.tsx` (handled in Task 6) and `app/account/rewards/page.tsx` (handled in Task 7). If anything else turns up, note it — it's out of the file list above and needs its own one-line fix here before continuing (same pattern: `/login` → `/sign-in`, `/signup` → `/sign-up`).

- [ ] **Step 5: Verify the redirects work**

Run: `npm run dev` (if not already running)
Run: `curl -sI http://localhost:3000/login | head -5`
Expected: `HTTP/1.1 308 Permanent Redirect` with `location: /sign-in`

Run: `curl -sI http://localhost:3000/signup | head -5`
Expected: `HTTP/1.1 308 Permanent Redirect` with `location: /sign-up`

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors (confirms nothing else imports the deleted files)

```bash
git add -A
git commit -m "refactor: consolidate /login+/signup into /sign-in+/sign-up"
```

---

## Task 3: Redesign `/sign-in`

**Files:**
- Modify: `app/sign-in/page.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `components/ThemeToggle.tsx` (Task 1) — the page itself never needs the `theme` value, only the toggle button, since every visual change is done via `dark:` classes
- Produces: no new exports; same default export `SignInPage`

This page keeps its exact current structure (split panel: dark brand imagery left, form right) and behavior (OAuth buttons, email/password form, role-based post-login redirect). Two changes: (a) fold in `/login`'s dynamic-logo fetch, (b) make both panels theme-aware and add the toggle.

- [ ] **Step 1: Add the dynamic logo fetch and theme toggle import**

At the top of `app/sign-in/page.tsx`, add to the imports and add new state/effect:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import { Mail, Lock, Eye, EyeOff, ChevronRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function SignInPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [loading, setLoading]           = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.logo_url) setLogoUrl(d.logo_url) })
      .catch(() => {})
  }, [])
```

(Keep `handleSubmit` and `handleOAuth` exactly as they are today — no changes to their logic.)

- [ ] **Step 2: Make the left brand panel theme-aware and use the fetched logo**

Replace the left panel's `<Image>` line (currently `<Image src="/LOGOS.png" ...>`) with:

```tsx
<Image
  src={logoUrl ?? '/LOGOS.png'}
  alt="Chicken Time"
  width={960}
  height={200}
  className="w-full h-auto drop-shadow-2xl"
  unoptimized={!!logoUrl}
/>
```

The left panel is already dark (`bg-brand-dark`) regardless of theme — brand imagery stays constant in both modes by design (it's not a "surface," it's branding), so no `dark:` classes needed there.

- [ ] **Step 3: Make the right form panel theme-aware**

The right panel currently hardcodes light-mode classes. Apply this class mapping throughout the right-panel `<div>` (from `<div className="w-full lg:w-1/2 flex items-center justify-center bg-white ...">` down to its closing tag):

| Element | Current class | New class (append `dark:` variants) |
|---|---|---|
| Panel background | `bg-white` | `bg-white dark:bg-zinc-950` |
| "Home" link (mobile) | `text-gray-400 hover:text-gray-700` | `text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300` |
| `<h1>` "Welcome back" | `text-brand-dark` | `text-brand-dark dark:text-white` |
| Subtitle paragraph | `text-gray-500` | `text-gray-500 dark:text-zinc-400` |
| "Quick sign in" label | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |
| Google button | `bg-white hover:bg-gray-50 text-gray-800 border border-gray-200` | `bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700` |
| Facebook button | (no change — solid brand blue reads fine on both) | unchanged |
| Divider lines | `bg-gray-100` | `bg-gray-100 dark:bg-zinc-800` |
| Divider text | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |
| Field labels (`FULL NAME` etc.) | `text-gray-700` | `text-gray-700 dark:text-zinc-400` |
| "Forgot password?" link | `text-brand-red` | `text-brand-red dark:text-red-400` |
| Input icons (Mail/Lock) | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |
| Text inputs | `border-gray-200 text-brand-dark placeholder:text-gray-400` | `border-gray-200 text-brand-dark placeholder:text-gray-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white dark:placeholder:text-zinc-600` |
| Show/hide password icon button | `text-gray-400 hover:text-gray-700` | `text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300` |
| Error banner | `bg-red-50 border-red-200` / text `text-red-600` | `bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50` / `text-red-600 dark:text-red-400` |
| Footer "Don't have an account?" | `text-gray-500` | `text-gray-500 dark:text-zinc-500` |

The submit button (`bg-brand-red`) and Facebook button stay as-is in both themes — solid brand colors don't need a dark variant.

- [ ] **Step 4: Add the theme toggle and Apple-standard polish**

Add `<ThemeToggle />` to the top-right of the right form panel (inside the `<div className="w-full max-w-sm py-10">`, as a sibling positioned via a small flex row with the "Home" link):

```tsx
<div className="lg:hidden flex items-center justify-between mb-8">
  <Link
    href="/"
    className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-300 text-xs font-semibold uppercase tracking-wider transition-colors"
  >
    <ArrowLeft size={13} /> Home
  </Link>
  <ThemeToggle />
</div>
<div className="hidden lg:flex justify-end mb-4">
  <ThemeToggle />
</div>
```

(This replaces the existing standalone mobile-only "Home" link — the old `lg:hidden` link becomes part of this flex row instead of its own block.)

For the Apple-standard visual pass on this page: add `active:scale-[0.98] transition-transform` to the Google button, Facebook button, and submit button's existing `className` strings (append to the class list, don't replace anything), and change the two OAuth button and submit button's `rounded-xl` to `rounded-2xl` for the softer, larger-radius look. Inputs stay `rounded-xl` (smaller controls read better with a tighter radius).

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (if not already running)

In Chrome, navigate to `http://localhost:3000/sign-in`:
1. Confirm the page renders in the theme set by the previous task's `localStorage.theme` test value.
2. Click the theme toggle — form panel background, text, inputs, and borders should all flip between light and dark without a page reload.
3. Confirm the left brand panel stays dark in both modes.
4. Tab through the form fields — focus rings still visible in both themes (uses `focus:ring-brand-red/10`, unaffected by this change).
5. Submit an invalid login — error banner renders correctly in both themes.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add app/sign-in/page.tsx
git commit -m "feat: theme-aware redesign of /sign-in, fold in dynamic logo fetch"
```

---

## Task 4: Redesign `/sign-up`

**Files:**
- Modify: `app/sign-up/page.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `components/ThemeToggle.tsx` (Task 1) — same as Task 3, no direct use of the `theme` value needed
- Produces: no new exports; same default export `SignUpPage`

Same treatment as Task 3, applied to `/sign-up`'s equivalent elements (it shares the identical split-panel structure and class names for the shared pieces — logo, divider, buttons, inputs, footer link — plus its own "Full name" and "Confirm password" fields and the post-submit "Check your email" success screen).

- [ ] **Step 1: Add theme toggle import**

Add to imports:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle'
```

- [ ] **Step 2: Apply the same class mapping as Task 3, Step 3**

Apply the identical light→dark class additions from the Task 3 table to `/sign-up`'s right-panel elements (same class names appear verbatim in this file: panel background, "Home" link, `<h1>`, subtitle, "Quick sign up" label, Google button, divider, field labels, inputs, error banner, footer link). Also apply to the two fields unique to this page:

| Element | Current class | New class |
|---|---|---|
| "Full name" input icon (User) | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |
| "Confirm password" input icon (Lock) | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |
| Terms/Privacy footer text | `text-gray-400` | `text-gray-400 dark:text-zinc-500` |

- [ ] **Step 3: Make the "Check your email" success screen theme-aware**

The success screen (`if (success) { return (...) }` block) currently hardcodes `bg-white`. Update:

```tsx
if (success) {
  return (
    <div className="h-[calc(100dvh-4rem)] flex items-center justify-center bg-white dark:bg-zinc-950 px-4">
      <div className="w-full max-w-sm text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="font-heading font-black text-2xl text-brand-dark dark:text-white mb-2">Check your email</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          We sent a confirmation link to{' '}
          <span className="font-semibold text-brand-dark dark:text-white">{email}</span>.
          Click it to activate your account.
        </p>
        <Link href="/sign-in" className="text-sm text-brand-red dark:text-red-400 font-bold hover:underline">
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add the theme toggle and Apple-standard polish**

Same as Task 3, Step 4: add the `ThemeToggle` in the same flex-row position next to the mobile "Home" link (and the desktop-only row above the form), and append `active:scale-[0.98] transition-transform` plus `rounded-xl` → `rounded-2xl` to the Google/Facebook/submit buttons.

- [ ] **Step 5: Manual verification**

Run: `npm run dev` (if not already running)

In Chrome, navigate to `http://localhost:3000/sign-up`:
1. Toggle theme — confirm all elements flip correctly, including validation error states (mismatched passwords).
2. Submit a valid sign-up (use a throwaway test email) and confirm the "Check your email" screen renders correctly in both themes.
3. Confirm the "Back to Sign In" link still points to `/sign-in`.

- [ ] **Step 6: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add app/sign-up/page.tsx
git commit -m "feat: theme-aware redesign of /sign-up"
```

---

## Task 5: Fix stale header auth state

**Files:**
- Modify: `components/SiteHeader.tsx`

**Interfaces:**
- Consumes: `supabase` singleton from `lib/supabase-browser.ts`
- Produces: no new exports; same export `SiteHeader`

`SiteHeader` currently checks `supabase.auth.getSession()` once on mount. Since it's a persistent layout component (rendered once, not remounted on client-side navigation), signing in or out elsewhere in the app leaves it showing stale state until a hard refresh.

- [ ] **Step 1: Replace the one-shot session check with a live listener**

In `components/SiteHeader.tsx`, replace:

```tsx
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      setIsLoggedIn(true)
      fetch('/api/loyalty/balance').then(async (r) => {
        if (r.ok) { const d = await r.json(); setLoyaltyPoints(d.balance ?? 0) }
      })
    })
  }, [])
```

with:

```tsx
  useEffect(() => {
    function syncFromSession(hasSession: boolean) {
      setIsLoggedIn(hasSession)
      if (!hasSession) {
        setLoyaltyPoints(null)
        return
      }
      fetch('/api/loyalty/balance').then(async (r) => {
        if (r.ok) { const d = await r.json(); setLoyaltyPoints(d.balance ?? 0) }
      })
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncFromSession(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev` (if not already running)

In Chrome:
1. Sign in via `/sign-in`. Without reloading the page after landing on `/account`, navigate back to `/` (client-side nav via a `<Link>`, e.g. the logo). Header should show "My Account" / points pill immediately — not "Sign In"/"Sign Up".
2. From `/account`, click "Sign out". Header should immediately show "Sign In"/"Sign Up" again on whatever page you land on, no manual refresh needed.

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add components/SiteHeader.tsx
git commit -m "fix: SiteHeader now reacts to sign-in/sign-out instead of only checking auth on mount"
```

---

## Task 6: Redesign the dashboard (`/account`)

**Files:**
- Modify: `app/account/page.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `components/ThemeToggle.tsx` (Task 1)
- Produces: no new exports; same default export `AccountPage`

- [ ] **Step 1: Fix the redirect-target bug**

In `app/account/page.tsx`, two occurrences of `/login` need to become `/sign-in`:

```tsx
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/sign-in'); return }
      setUser(u)
      setLoading(false)
      fetchActiveOrders()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
```

and:

```tsx
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/sign-in')
    router.refresh()
  }
```

(Note the added `router.refresh()` — belt-and-braces alongside Task 5's `onAuthStateChange` fix, ensuring any server-rendered state is consistent after sign-out.)

- [ ] **Step 2: Add the theme toggle to the sticky header**

Add to imports:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle'
```

In the sticky header JSX, add `<ThemeToggle />` next to the "Sign out" button, and update the header's own classes to the final theme-aware versions directly (these three lines are part of the same mapping applied mechanically to the rest of the file in Step 3 — the header is done here so this step is self-contained and testable on its own):

```tsx
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-900">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-2xl leading-none">🍗</Link>
            <div>
              <p className="text-sm font-semibold leading-none text-brand-dark dark:text-white">My Account</p>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[180px]">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors active:scale-[0.98]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </div>
```

- [ ] **Step 3: Make the rest of the page's surfaces theme-aware**

The header (Step 2) is done. Everything else in the file currently assumes dark (root `<div className="min-h-screen bg-zinc-950 text-white">`, tab bar, every card). Apply this class mapping — each row shows every remaining occurrence of that exact class string in the file and its replacement:

| Current class (as it appears in the file) | New class |
|---|---|
| `min-h-screen bg-zinc-950 text-white` (root div, loading div) | `min-h-screen bg-white dark:bg-zinc-950 text-brand-dark dark:text-white` |
| `border-b border-zinc-900 bg-zinc-950` (tab bar wrapper) | `border-b border-zinc-200 dark:border-zinc-900 bg-white dark:bg-zinc-950` |
| `text-zinc-500` (generic secondary text, many occurrences) | `text-zinc-500 dark:text-zinc-500` — no change needed, zinc-500 reads fine on both; leave as-is |
| `bg-zinc-900 border border-zinc-800 rounded-2xl` (`OrderCard`, `OfferCard`, profile card, security cards — every card surface) | `bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm dark:shadow-none` |
| `bg-zinc-800 border border-zinc-700` (form inputs) | `bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700` |
| `text-white` (headings inside cards, e.g. `<h3>` order id... actually order id uses `text-zinc-500`; applies to labels like "Password", "Close Account" heading text, save button text is already white-on-red so skip) | `text-brand-dark dark:text-white` |
| `border-zinc-800` (dividers, e.g. total/actions border-top) | `border-zinc-200 dark:border-zinc-800` |
| Tab button inactive state `text-zinc-500 hover:text-zinc-300` | unchanged — reads fine on both |
| Tab button active state `border-brand-red text-white` | `border-brand-red text-brand-dark dark:text-white` |

Apply this mapping mechanically across the whole file — every `bg-zinc-900 border border-zinc-800 rounded-2xl` card wrapper (there are 6+: `OrderCard`, `OfferCard`, profile form card, security password card, security close-account card) gets the same replacement. Bump `rounded-2xl` → `rounded-3xl` on these top-level cards as part of the Apple-standard pass (inner elements like the offer code pill stay `rounded-full`/`rounded-lg` as-is).

- [ ] **Step 4: Replace spinner-only loading states with skeletons**

Add a `Skeleton` helper (same pattern already used in `app/account/rewards/page.tsx` — reuse the concept, don't import cross-file, just duplicate this ~3-line helper since it's trivial and each page is meant to be self-contained per the existing codebase convention):

```tsx
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg ${className ?? ''}`} />
  )
}
```

Replace each of the four `<Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />` centered-spinner blocks (Active Orders loading, History loading, Profile loading, plus the top-level page `loading` state) with a skeleton matching that section's eventual content shape. For the top-level page loading state:

```tsx
  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 px-4 py-6 max-w-lg mx-auto space-y-4">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    )
  }
```

For the Active Orders / History tab loading states (each currently `<div className="flex justify-center py-12"><Loader2 .../></div>`):

```tsx
              <div className="space-y-4">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <Skeleton className="h-40 w-full rounded-3xl" />
              </div>
```

For the Profile tab loading state, same pattern with a shorter skeleton (`h-64 w-full rounded-3xl` for the single form card).

- [ ] **Step 5: Add tap-scale micro-interaction to primary buttons**

Append `active:scale-[0.98] transition-transform` to the `className` of: "Order now" link, "Save Changes" button, "Send Password Reset Email" button, "Close My Account" button, "Yes, Delete" button, "Copy" button (in `OfferCard`), "Reorder"/"Receipt" buttons (in `OrderCard`). Don't touch tab buttons or the refresh icon button (those already have their own hover feedback, adding scale would be visual noise on small icon-only controls).

- [ ] **Step 6: Manual verification**

Run: `npm run dev` (if not already running)

In Chrome, sign in and navigate to `/account`:
1. Toggle theme — every tab (Active, History, Offers, Rewards, Profile, Security) should render correctly in both themes, no unstyled-looking elements (check for any residual pure-black-on-black or pure-white-on-white text by eye).
2. Trigger a loading state (throttle network in devtools, switch tabs) — confirm skeletons render instead of a bare spinner.
3. Click "Save Changes" on Profile — button should visibly depress (scale down) on click.
4. Click "Sign out" — confirm redirect to `/sign-in` (not `/login`) and header updates immediately (Task 5's fix).

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add app/account/page.tsx
git commit -m "feat: theme-aware Apple-standard redesign of /account dashboard, fix redirect targets"
```

---

## Task 7: Redesign `/account/rewards`

**Files:**
- Modify: `app/account/rewards/page.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` from `components/ThemeToggle.tsx` (Task 1)
- Produces: no new exports; same default export `RewardsPage`

- [ ] **Step 1: Fix the redirect-target bug**

In `app/account/rewards/page.tsx`, the "Sign in to view your rewards" link currently points to `/login`:

```tsx
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 bg-brand-red hover:bg-brand-red/90 text-white font-semibold
                         rounded-xl px-6 py-3 text-sm transition-colors active:scale-[0.98]"
            >
              Sign In
            </Link>
```

(Also added `active:scale-[0.98]` here as part of the Apple-standard pass.)

- [ ] **Step 2: Add theme toggle and apply the same class mapping as Task 6, Step 3**

Add imports:

```tsx
import { ThemeToggle } from '@/components/ThemeToggle'
```

Apply the identical class mapping from Task 6 Step 3 to this file's three top-level surfaces (not-signed-in screen, loading screen, full render) and every `bg-zinc-900 border-zinc-800` card (`RewardCard`, points-balance gradient card, available/used-rewards empty states, transaction history panel). The existing `Skeleton` helper in this file already uses `bg-zinc-800` — update it to match Task 6's skeleton color mapping:

```tsx
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg ${className ?? ''}`} />
  )
}
```

Add `<ThemeToggle />` to each of the three sticky headers (not-signed-in, loading, full render), next to the back arrow, mirroring Task 6 Step 2's placement pattern (flex row, toggle on the trailing side).

- [ ] **Step 3: Apple-standard polish**

Bump the points-balance gradient card and `RewardCard` from `rounded-2xl` to `rounded-3xl`. Append `active:scale-[0.98] transition-transform` to the "Unlock for N pts" button and the "History" expand/collapse button.

- [ ] **Step 4: Manual verification**

Run: `npm run dev` (if not already running)

In Chrome, navigate to `/account/rewards` (signed in):
1. Toggle theme — points balance card, reward cards, transaction history all render correctly in both themes.
2. Sign out, navigate to `/account/rewards` directly — "Sign in to view your rewards" screen renders correctly in both themes, its Sign In button goes to `/sign-in`.

- [ ] **Step 5: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors

```bash
git add app/account/rewards/page.tsx
git commit -m "feat: theme-aware redesign of /account/rewards, fix sign-in link"
```

---

## Task 8: Full end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Repo-wide grep for stray old-route references**

Run: `grep -rn "'/login'\|\"/login\"\|'/signup'\|\"/signup\"" app components lib --include="*.tsx" --include="*.ts"`
Expected: no matches (Task 2 Step 4 already handled the two known ones in Tasks 6/7; this re-confirms nothing was missed and nothing regressed).

- [ ] **Step 2: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run existing test suite**

Run: `npx vitest run`
Expected: all tests pass, including the new `lib/theme.test.ts` from Task 1 and the pre-existing `lib/order-status.test.ts`.

- [ ] **Step 4: Full browser walkthrough**

Run: `npm run dev` (if not already running)

In Chrome, with `localStorage.theme` cleared (so it starts from system preference), walk the complete journey:
1. From `/`, click "Sign Up" in the header → lands on `/sign-up`.
2. Toggle theme partway through filling the form — confirm it persists.
3. Sign up with a throwaway email → "Check your email" screen.
4. Navigate to `/sign-in`, sign in with an existing test account.
5. Confirm redirect to `/account` (or `/driver/dashboard`/`/admin/redirect` if the test account has that role — use a plain customer account for this walkthrough).
6. Click through every dashboard tab: Active, History (reorder + print receipt if any past orders exist), Offers, Rewards (opens `/account/rewards`, back button returns to `/account`), Profile (edit + save), Security (password reset request, close-account confirm dialog — don't actually confirm delete).
7. Toggle theme again from within the dashboard — confirm it's still in sync with what was set on the auth pages (same `localStorage` key, same session).
8. Click "Sign out" → confirm immediate redirect to `/sign-in` and the site header (visit `/`) shows logged-out state without a manual refresh.
9. Manually visit `http://localhost:3000/login` and `http://localhost:3000/signup` → confirm both redirect to the new canonical routes.

- [ ] **Step 5: Update the design spec status**

In `docs/superpowers/specs/2026-09-15-customer-auth-dashboard-redesign-design.md`, change the header:

```md
Status: Approved, pending implementation plan
```

to:

```md
Status: Implemented
```

- [ ] **Step 6: Final commit**

```bash
git add docs/superpowers/specs/2026-09-15-customer-auth-dashboard-redesign-design.md
git commit -m "docs: mark customer auth/dashboard redesign spec as implemented"
git push
```
