---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, mobile, playbook, react-native, expo, ios, android]
---

# Mobile App Build Playbook

> *NexoFlow's phase-by-phase execution guide for mobile applications. From first conversation to App Store. Opinionated, production-grade, no hand-waving.*

---

## Stack Selection Logic

```
START: New mobile project

Is this web content wrapped in a native shell (articles, listings)?
  → YES: PWA or Capacitor. Not a native app.
  → NO: Continue.

Is the team entirely iOS/Android specialists with no web background?
  → YES: SwiftUI (iOS) / Jetpack Compose (Android) — native per platform
  → NO: Continue to cross-platform.

Does the app need heavy native platform integration (ARKit, Core ML, HealthKit)?
  → YES: 
    → iOS only: SwiftUI
    → Android only: Jetpack Compose
    → Both: Flutter with native plugins OR React Native + custom modules
  → NO: Continue.

Does the client need code sharing with a web product?
  → YES → React Native + Expo (shared logic, shared types, shared API layer)
  → NO: Continue.

Is this a highly visual, animation-intensive app (>60fps custom animations)?
  → YES → Flutter (Skia/Impeller renderer = best custom animation performance)
  → NO: React Native + Expo (default NexoFlow choice)

Does the project need a single codebase for iOS, Android, AND a web companion?
  → YES → React Native + Expo (with Expo for Web) or Next.js monorepo with shared packages
```

**NexoFlow default: React Native + Expo.** Covers 85%+ of projects. Use it unless a specific condition above overrides.

---

## Phase 1 — Discovery (1–5 days)

**Inputs:** Client brief, stakeholder interviews  
**Outputs:** Product brief, user personas, success metrics, go/no-go on scope

### Discovery Checklist
```
□ Platform targets confirmed: iOS only / Android only / both
□ Distribution model: App Store / Google Play / enterprise / TestFlight only
□ Authentication: social (Google/Apple) / email+password / SSO / biometric
□ Offline capability required? (changes architecture fundamentally)
□ Push notifications: local only / remote (FCM/APNs) / both
□ In-app purchases or subscriptions? (RevenueCat required)
□ External integrations: REST API / GraphQL / WebSocket / BLE / NFC
□ Data sync requirements: real-time / background / manual
□ Analytics and crash reporting requirements confirmed
□ Accessibility requirements (WCAG AA minimum)
□ Performance expectations: target devices, minimum iOS/Android version
□ App Store account status: does client have developer accounts?
  → iOS: Apple Developer Program (£99/year) — must be active before build
  → Android: Google Play Developer ($25 one-time) — must be active before build
```

### Go/No-Go Gates
Do not proceed until:
- [ ] Core user flow defined (max 3 primary flows)
- [ ] Success metrics agreed (DAU, retention, conversion — specific numbers)
- [ ] Budget confirmed for App Store costs + Apple developer account
- [ ] Timeline agrees with scope (no "2-week MVP" for complex apps with auth + payments)

---

## Phase 2 — Architecture (2–4 days)

**Outputs:** Architecture doc, data model, API contract, component hierarchy

### Architecture Decisions (lock these before build)

**Navigation architecture:**
```
Default: Expo Router (file-based routing, URL-friendly, deep link native)
Fallback: React Navigation v6 (when Expo Router limitations apply)

Decision: use Expo Router for all new projects. It handles deep linking natively.
```

**State architecture:**
```
Global state: Zustand (lightweight, TypeScript-first, devtools)
Server state: TanStack Query (caching, background refetch, offline)
Local persistence: MMKV (faster than AsyncStorage, encrypted option)
Forms: React Hook Form + Zod (same as web — consistent patterns)
```

**Auth architecture:**
```
Token storage: Expo SecureStore (Keychain on iOS, Keystore on Android)
NEVER: AsyncStorage for tokens (plaintext, not encrypted)
Session: short-lived JWT + refresh token rotation
Social: expo-auth-session for OAuth flows
Biometric: expo-local-authentication for Touch/Face ID gate on secure screens
```

**API layer:**
```typescript
// Typed fetch wrapper — every API call goes through this
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = await SecureStore.getItemAsync('auth_token')
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw new APIError(res.status, await res.json())
  return res.json() as Promise<T>
}
```

**Offline-first architecture (when required):**
```
WatermelonDB: relational local DB with lazy loading (use for complex data)
MMKV + TanStack Query persistence: for simpler key-value offline needs
Sync strategy: optimistic updates + background sync + conflict resolution
```

---

## Phase 3 — Core Build (60–75% of timeline)

### Sprint Structure for Mobile

Week 1: Auth + navigation skeleton + API integration layer  
Week 2: Core feature 1 (the app's primary value proposition)  
Week 3: Core feature 2 + push notifications foundation  
Week 4: Core feature 3 + background sync  
Week 5+: Polish, edge cases, accessibility, performance  

### Build Standards During Core Phase

**Component naming:**
```
screens/ → [Name]Screen.tsx (e.g., HomeScreen, ProfileScreen)
components/ → [Name].tsx (reusable, no Screen suffix)
hooks/ → use[Name].ts (e.g., useAuth, usePosts)
stores/ → [name]Store.ts (Zustand stores)
```

**Performance non-negotiables during build:**
- No `console.log` in production (babel-plugin-transform-remove-console)
- Hermes JavaScript engine enabled (default in Expo SDK 48+)
- `useMemo` / `useCallback` for expensive computations and callbacks in lists
- `FlashList` instead of `FlatList` for any list >50 items
- Images: `expo-image` with caching, never raw `<Image>`
- Lazy load screens with `React.lazy` + Suspense

---

## Phase 4 — Polish (15% of timeline)

### Onboarding Flow
Every consumer app needs an onboarding flow. Standards:
- Maximum 3 onboarding screens
- Skip button always visible
- Onboarding state persisted (don't show again after first completion)
- Permissions requests deferred until feature first used (not on launch)

### Loading, Empty, and Error States
```
Every data-dependent screen must handle:
  □ Loading: Skeleton screens (not spinners — skeleton matches content layout)
  □ Empty: Illustration + action CTA (not "No data found")
  □ Error: Human message + retry action (not "Something went wrong")
  □ Offline: Banner + queued action state
```

### Gesture Standards
```
Swipe to go back: always enabled (iOS default, implement for Android)
Pull to refresh: on any list or feed screen
Swipe to dismiss: modals, bottom sheets
Long press: for secondary actions (same as iOS haptic context menu)
```

### Haptics
```typescript
import * as Haptics from 'expo-haptics'

// Use haptics on: button press, success, error, selection change
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)   // button tap
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) // action complete
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)   // validation error
```

---

## Phase 5 — Testing (integrated throughout + final sprint)

### Test Coverage Requirements
```
Unit tests (Jest + React Native Testing Library):
  → Business logic: 100% (hooks, stores, utility functions)
  → Components: happy path + error state
  → Coverage target: >75% overall

E2E tests (Maestro):
  → Auth flow (sign up, sign in, sign out)
  → Core user flow (the app's primary job)
  → Payment/purchase flow (if applicable)

Device matrix (minimum before submission):
  iOS: iPhone SE (small), iPhone 14 (standard), iPad (if universal)
  Android: Pixel 4a (budget), Samsung Galaxy S22 (flagship)
```

---

## Phase 6 — App Store Submission

### Pre-Submission Checklist (iOS)
```
□ App icons generated for all sizes (use Expo's asset generation)
□ Launch screen configured (no white flash on startup)
□ Privacy manifest (PrivacyInfo.xcprivacy) — required from May 2024
□ App Privacy labels completed in App Store Connect (data types declared)
□ Screenshots: 6.9" (required), 6.5", 5.5", iPad 12.9" (if universal)
□ App description written (keyword-optimised, 4000 char max)
□ Keywords entered (100 char max, no competitor names)
□ Age rating questionnaire completed
□ Review notes written (explain any non-obvious features to App Review)
□ Test account credentials included for App Review
□ All push notification entitlements configured
□ In-app purchase products configured in App Store Connect (if applicable)
□ TestFlight beta tested with 5+ real users
```

### Pre-Submission Checklist (Android)
```
□ App icons + feature graphic (1024×500) prepared
□ Screenshots: phone (required), 7-inch tablet, 10-inch tablet
□ Content rating questionnaire completed
□ Data safety section completed (what data collected, shared, purposes)
□ Store listing description written
□ Internal test track → closed testing → production (staged rollout recommended)
□ Target API level ≥ Android 14 (API 34) — Google Play requirement
□ 64-bit APK/AAB only
□ Proguard/R8 configured for release builds
```

### OTA Update Strategy (Expo EAS Update)
```
Production update policy:
  → Bug fixes: EAS Update immediately (no App Store review)
  → New features: EAS Build → App Store submission
  → Critical security: EAS Update same day

EAS Update channels:
  preview  → TestFlight/Internal Track
  staging  → select beta users
  production → all users

Staged rollout: start at 10% → monitor crash rate → 50% → 100%
```

---

## Performance Benchmarks — Ship Standard

| Metric | Target | Rejection Threshold |
|---|---|---|
| Cold start (first launch) | <3 seconds | >5 seconds |
| Cold start (repeat launch) | <1.5 seconds | >3 seconds |
| Scroll FPS | 60fps steady | <45fps average |
| API response (perceived) | <500ms with loading state | No loading state = always wrong |
| App binary size (iOS) | <50MB download | >100MB without justification |
| App binary size (Android) | <30MB download | >80MB without justification |
| Crash-free rate (post-launch) | >99.5% | <99% = ship-stopping |

---

## Related
- [[NexoFlow System/Knowledge and Tech/Mobile Engineering Standards]]
- [[Maps of Content/Mobile Apps MOC]]
- [[NexoFlow System/Knowledge and Tech/AI System Design Guide]]
- [[NexoFlow System/Quality Assurance Framework]]
- [[NexoFlow System/NexoFlow Services]]
