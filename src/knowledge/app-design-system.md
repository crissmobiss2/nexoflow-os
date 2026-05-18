---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, design, ux, mobile, desktop, system, standards, components]
status: canonical
---

# App Design System

> *NexoFlow's design standards for web, mobile, and desktop applications. Consistent across every product NexoFlow ships. Premium UX is not an accident — it comes from applying these patterns deliberately.*

---

## Design Philosophy

NexoFlow builds software that looks and feels as good as it works. Not decorative — functional elegance:

1. **Clarity over cleverness** — the best UI is the one users don't think about
2. **Density over padding** — information on screen > white space for its own sake
3. **Speed over animation** — apps feel fast because they ARE fast, not because loading feels smooth
4. **Consistency over novelty** — familiar patterns reduce cognitive load
5. **Mobile-first, desktop-enhanced** — design for the smallest screen, expand for larger

---

## Color System

```typescript
// NexoFlow's production color token system (CSS variables + Tailwind config)

// Base palette — adjust hue per project, keep structure
:root {
  /* Brand */
  --brand-50: hsl(220, 100%, 97%);
  --brand-100: hsl(220, 95%, 92%);
  --brand-500: hsl(220, 85%, 57%);   /* Primary action */
  --brand-600: hsl(220, 85%, 50%);   /* Primary hover */
  --brand-900: hsl(220, 60%, 20%);   /* Dark contexts */

  /* Neutral (grays) */
  --neutral-0: hsl(0, 0%, 100%);
  --neutral-50: hsl(220, 20%, 98%);
  --neutral-100: hsl(220, 15%, 95%);
  --neutral-200: hsl(220, 13%, 90%);
  --neutral-500: hsl(220, 9%, 55%);
  --neutral-700: hsl(220, 12%, 35%);
  --neutral-900: hsl(220, 15%, 12%);
  --neutral-950: hsl(220, 20%, 7%);

  /* Semantic */
  --success: hsl(152, 70%, 40%);
  --warning: hsl(38, 92%, 50%);
  --error: hsl(0, 75%, 52%);
  --info: hsl(201, 90%, 45%);

  /* Surface (light mode) */
  --bg-base: var(--neutral-0);
  --bg-subtle: var(--neutral-50);
  --bg-muted: var(--neutral-100);
  --border-default: var(--neutral-200);
  --text-primary: var(--neutral-900);
  --text-secondary: var(--neutral-700);
  --text-muted: var(--neutral-500);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-base: var(--neutral-950);
    --bg-subtle: hsl(220, 16%, 10%);
    --bg-muted: hsl(220, 14%, 14%);
    --border-default: hsl(220, 12%, 22%);
    --text-primary: hsl(220, 20%, 96%);
    --text-secondary: hsl(220, 12%, 70%);
    --text-muted: hsl(220, 10%, 50%);
  }
}
```

**Color usage rules:**
- Brand-500: primary CTAs, focus rings, active states
- Never use >3 colors on a single screen (brand + neutral + one semantic)
- Text on colored backgrounds: always check 4.5:1 contrast minimum

---

## Typography System

```typescript
// Font stack — same across web and mobile (with platform fallbacks)

Web:
  font-sans: Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif
  font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace

Mobile (React Native):
  Default: system font (San Francisco on iOS, Roboto on Android)
  Custom: Inter via expo-font (load in app root, use consistently)

Desktop:
  Same as web — Tauri uses system webview, all web fonts apply

Type scale (Major Third ratio, base 16px):
  xs:  12px / 16px line-height (labels, captions)
  sm:  14px / 20px (supporting text)
  md:  16px / 24px (body — default)
  lg:  18px / 28px (lead text, prominent body)
  xl:  20px / 30px (section headers on mobile)
  2xl: 24px / 32px (page titles on mobile, section headers on desktop)
  3xl: 30px / 38px (hero headings on desktop)
  4xl: 36px / 44px (landing page hero)

Font weight usage:
  Regular (400): body text
  Medium (500): UI labels, nav items
  Semibold (600): headings, prominent labels
  Bold (700): emphasis only, never decorative
```

---

## Spacing System

```
Base unit: 4px (0.25rem)

Scale:
  1:  4px   (0.25rem) — micro: icon padding, tight spacing
  2:  8px   (0.5rem)  — small: internal component padding
  3:  12px  (0.75rem) — compact: list items, small cards
  4:  16px  (1rem)    — standard: most internal padding
  5:  20px  (1.25rem) — comfortable
  6:  24px  (1.5rem)  — section spacing
  8:  32px  (2rem)    — larger sections
  10: 40px  (2.5rem)  — page sections
  12: 48px  (3rem)    — hero sections, top-of-page spacing
  16: 64px  (4rem)    — full-page section spacing

Rules:
  → Internal padding: space-4 (16px) minimum for interactive elements
  → Between sections: space-8 or space-10 minimum
  → Minimum touch target (mobile): 44×44px (applies CSS min-height: 44px min-width: 44px)
  → Desktop control height: 36px default, 40px comfortable
```

---

## Component Standards

### Buttons

```typescript
// Button hierarchy — use exactly this hierarchy, don't invent variants
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

// Primary: one per screen/section. The main action.
// Secondary: supporting action alongside primary. Outlined.
// Ghost: tertiary actions in toolbars, icon buttons.
// Destructive: delete, cancel subscription, irreversible actions. Red.
// Link: navigation that looks like text.

// Loading states: always show spinner + disable during async action
// Full width: only in mobile and form contexts — not in toolbars

// Standard sizes:
// sm: h-8, text-sm, px-3  (secondary actions in dense UI)
// md: h-10, text-sm, px-4 (default)
// lg: h-12, text-base, px-6 (CTAs, form submission)
```

### Form Inputs

```typescript
// Form standard: React Hook Form + Zod (same on web and React Native)

// Every form input needs:
// 1. Label (visible — never placeholder-only)
// 2. Optional indicator (grey "(optional)" suffix, not asterisk on required)
// 3. Error message (below input, red, specific — not just "Invalid")
// 4. Helper text (below label, grey, visible before interaction)

// Validation:
// → Validate on blur (not on change — less noisy)
// → Show errors after first submission attempt, then on blur
// → Error messages: what's wrong + how to fix it ("Must be at least 8 characters")

// Never:
// → Disable the submit button before first attempt (frustrating UX)
// → Clear inputs on validation failure
// → Show all errors on page load before user interaction
```

### Data Tables

```typescript
// Tables are for data-dense interfaces (admin, dashboards, reporting)
// Column rules:
//   → Sort indicator on all sortable columns (chevron up/down)
//   → Row actions: 3+ actions → dropdown menu; 1-2 → icon buttons
//   → Loading: skeleton rows (not spinner over table)
//   → Empty: empty state component with action CTA
//   → Pagination: show count "1-20 of 143" + prev/next

// Mobile: tables don't work on mobile — use cards instead
// Decision: if viewing on mobile is expected → cards, not table
```

### Loading States

```
Skeleton screens over spinners: 
  → Skeleton: matches content layout (size, shape) — reduces perceived latency
  → Spinner: only for operations where skeleton would be misleading (uploading, processing)
  → Full-page loader: only for initial app load — never for navigation

Skeleton rules:
  → Use CSS animation (pulse) — subtle, not distracting
  → Width should match approximate content width (not 100% full-width every time)
  → Line skeletons for text, box skeletons for images and cards
```

### Empty States

```
Every data list and table needs a designed empty state:
  Components:
    1. Illustration or icon (optional but improves clarity)
    2. Title: what's empty (2-4 words)
    3. Description: why it's empty + what to do (1 sentence)
    4. Action CTA: primary action to fill the empty state

Tone: helpful, not apologetic
  WRONG: "No data found"
  RIGHT: "No projects yet — create your first project to get started"
  
  WRONG: "There are currently no items in your list"
  RIGHT: "Your inbox is clear" (if that's genuinely a good state)
```

### Error States

```
Error messaging standards:
  → Be specific: "Email address is already registered" not "Invalid input"
  → Offer a solution: "Already registered? Sign in instead."
  → Don't blame the user: "Something went wrong on our end" not "Your request was invalid"
  → Include retry: always provide a way back from error states

Error severity:
  → Toast (transient, 4 second): non-blocking info, success confirmations
  → Inline (persistent): form validation, field-level errors
  → Banner (persistent): degraded service, session expiry warning
  → Page (full): 404, 500, access denied — always with navigation back
```

---

## Mobile-Specific Design Patterns

### Navigation Architecture

```
Tab Bar (bottom): 3-5 primary destinations
  → Icon + label (always label — icon-only is inaccessible)
  → Active: filled icon + brand color
  → Inactive: outline icon + muted text
  → Badge: for unread count (keep <99+)

Stack Navigation:
  → Back button: always native behavior (swipe back on iOS)
  → Header title: concise (max 2 words)
  → Header right: max 1-2 actions (icon buttons)

Modal / Bottom Sheet:
  → Bottom sheet: for actions, pickers, quick forms
  → Full modal: for multi-step flows, complex forms
  → Dismiss: swipe down always works on bottom sheets
```

### Touch Targets

```
Minimum: 44×44pt (Apple HIG) = 44×44dp (Material Design)
No visible tap area required — padding can create invisible touch area

Interactive spacing:
  → List items: minimum 48pt height (44pt content + 2pt padding each side)
  → Tab bar items: 44pt minimum height
  → Form inputs: 48pt minimum height
  → Floating action buttons: 56pt diameter
```

---

## Desktop-Specific Design Patterns

### Information Density

```
Desktop can show more per screen than mobile. Use it:
  → 3-4 column grids where mobile uses 1
  → Sidebar + content layout (impossible on mobile)
  → Data tables instead of cards
  → Hover states reveal additional detail (tooltips, action buttons)
  → Keyboard shortcuts visible in tooltips

Don't over-space desktop:
  → Padding that looks good on mobile is wasteful on desktop
  → Reduce mobile's space-6 to space-4 in desktop contexts
  → Fit more rows in tables (row height: 40px desktop, 56px mobile)
```

### Keyboard and Shortcuts

```
Every desktop app ships with:
  Cmd/Ctrl+K: command palette
  Cmd/Ctrl+Z: undo
  Cmd/Ctrl+Shift+Z: redo
  Cmd/Ctrl+N: new [primary resource]
  Cmd/Ctrl+S: save (if applicable)
  Escape: close modal/dialog/popover
  Tab/Shift+Tab: navigate form fields
  Enter: submit focused form
  Arrow keys: navigate lists

Shortcuts shown in:
  → Hover tooltip: "Create New  ⌘N"
  → Menu items: shortcut shown right-aligned
  → Keyboard shortcut help modal (usually ? or Cmd+/)
```

---

## Accessibility Baseline

```
NexoFlow minimum: WCAG 2.1 AA

Color:
  → Text/background contrast: ≥4.5:1 (normal text), ≥3:1 (large text)
  → Never use color as the only differentiator (add text, icon, or pattern)
  → Focus indicators: visible, high contrast (not just browser default)

Keyboard:
  → All interactive elements reachable via Tab
  → Logical focus order (matches visual order)
  → No keyboard traps
  → Skip-to-content link on web

Screen reader:
  → Meaningful alt text for all images (not "image.jpg")
  → Form labels programmatically associated (not just visually)
  → Error messages announced by screen reader
  → Loading states announced via aria-live

Mobile:
  → accessibilityLabel on all interactive elements
  → accessibilityRole on custom components
  → Don't set allowFontScaling={false} — ever
```

---

## Related
- [[NexoFlow System/Knowledge and Tech/Mobile Engineering Standards]]
- [[NexoFlow System/Knowledge and Tech/Desktop Engineering Standards]]
- [[NexoFlow System/Standards/NexoFlow Standards]]
- [[NexoFlow System/Quality Assurance Framework]]
- [[NexoFlow System/Playbooks/Mobile App Build Playbook]]
