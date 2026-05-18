---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, mobile, standards, react-native, expo, engineering]
status: canonical
---

# Mobile Engineering Standards

> *NexoFlow's canonical standards for mobile application development. These are not suggestions — every mobile project follows these standards. Deviations require a DECL entry.*

---

## Stack Declaration

**Primary:** React Native + Expo (SDK 51+, managed workflow)  
**Navigation:** Expo Router (file-based — preferred over React Navigation manual config)  
**State:** Zustand + MMKV persistence  
**Server state:** TanStack Query v5  
**Forms:** React Hook Form + Zod  
**Auth tokens:** Expo SecureStore — never AsyncStorage  
**Purchases:** RevenueCat — never raw StoreKit/Google Billing  
**Push:** Expo Notifications + FCM/APNs  
**Analytics:** PostHog mobile SDK  
**Errors:** Sentry React Native  
**Images:** expo-image — never core `Image`  
**OTA updates:** EAS Update  
**CI/CD:** EAS Build + EAS Submit  
**Testing:** Jest + React Native Testing Library + Maestro (E2E)

---

## TypeScript Configuration

```json
// tsconfig.json — strict mode, no exceptions
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Project Structure

```
app/                          # Expo Router screens (file-based routing)
  (auth)/
    login.tsx
    register.tsx
  (app)/
    index.tsx                 # Home screen
    [id].tsx                  # Dynamic route
  _layout.tsx                 # Root layout
src/
  components/                 # Reusable UI components
    ui/                       # Primitive components (Button, Input, etc.)
    [Name].tsx
  hooks/                      # Custom hooks (use[Name].ts)
  stores/                     # Zustand stores ([name]Store.ts)
  lib/
    api.ts                    # Typed API client
    auth.ts                   # Auth utilities
    constants.ts              # App-wide constants
  types/                      # Shared TypeScript types
assets/                       # Images, fonts, icons
```

---

## Authentication Standard

```typescript
// lib/auth.ts — CANONICAL auth pattern
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'auth_token'
const REFRESH_KEY = 'refresh_token'

export const auth = {
  async setTokens(access: string, refresh: string) {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ])
  },
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY)
  },
  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ])
  },
}

// In API layer: always read token from SecureStore, never from component state
```

---

## API Layer Standard

```typescript
// lib/api.ts
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_URL!

class APIError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API Error ${status}`)
  }
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync('auth_token')
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  if (res.status === 401) {
    // Attempt token refresh — if fails, logout
    await attemptTokenRefresh()
    return request<T>(endpoint, init) // retry once
  }

  if (!res.ok) throw new APIError(res.status, await res.json().catch(() => null))
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
```

---

## State Management Standard

```typescript
// stores/authStore.ts — Zustand with MMKV persistence
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storage } from '../lib/storage' // MMKV instance

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => storage), // MMKV, not AsyncStorage
    }
  )
)
```

---

## List Rendering Standard

```typescript
// RULE: Never use FlatList for lists >50 items — use FlashList
import { FlashList } from '@shopify/flash-list'

// estimatedItemSize is critical for performance — measure actual items
<FlashList
  data={items}
  renderItem={({ item }) => <ItemCard item={item} />}
  estimatedItemSize={80}
  keyExtractor={(item) => item.id}
/>

// For complex/variable height lists: measure first, set estimatedItemSize
// For horizontal lists: FlashList handles this natively
```

---

## Image Standard

```typescript
// RULE: Always expo-image. Never React Native's Image.
import { Image } from 'expo-image'

// expo-image provides: caching, blurhash placeholders, better performance
<Image
  source={{ uri: imageUrl }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  style={styles.image}
/>
```

---

## Push Notifications Standard

```typescript
// hooks/usePushNotifications.ts
import * as Notifications from 'expo-notifications'
import { useEffect } from 'react'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications() {
  useEffect(() => {
    // Request permissions on first meaningful interaction, NOT on app launch
    // Register token with backend when permission granted
  }, [])
}

// RULE: Never request push permission on cold launch. 
// Request it after the user has experienced value (feature that needs notifications).
```

---

## In-App Purchases Standard (RevenueCat)

```typescript
// RULE: Always RevenueCat. Never raw StoreKit or Google Billing.
// RevenueCat handles: receipt validation, cross-platform, web dashboard, webhooks

import Purchases, { LOG_LEVEL } from 'react-native-purchases'

// Initialize once in app root
if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG)
await Purchases.configure({
  apiKey: Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS!,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID!,
  })!,
})

// Check entitlements (do NOT rely on subscription status from your own DB)
const customer = await Purchases.getCustomerInfo()
const isPro = customer.entitlements.active['pro'] !== undefined
```

---

## Error Monitoring Standard (Sentry)

```typescript
// app/_layout.tsx — initialize once at app root
import * as Sentry from '@sentry/react-native'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN!,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.1,
})

// Wrap app with Sentry error boundary
export default Sentry.wrap(RootLayout)
```

---

## Performance Rules

```
1. Hermes engine: ALWAYS enabled (default in Expo SDK 48+, do not disable)
2. console.log: ZERO in production (use babel-plugin-transform-remove-console)
3. useMemo: use for expensive computations in render
4. useCallback: use for callbacks passed to child components or FlashList
5. Images: expo-image with explicit dimensions — never undefined dimensions
6. Animations: use react-native-reanimated (runs on UI thread, never JS thread)
7. Navigation: never navigate in useEffect without cleanup
8. Heavy operations: always run in background (use expo-task-manager or web workers equivalent)
9. Bundle: analyze with @expo/metro-config + source maps — no unused dependencies
10. Cold start: profile with Flipper or Expo Dev Tools — fix any >100ms blocking operations
```

---

## Accessibility Requirements

```
MINIMUM BAR: WCAG AA

All interactive elements:
  → accessibilityLabel (human-readable description)
  → accessibilityRole (button, link, header, etc.)
  → accessibilityState (disabled, selected, checked)
  → Minimum touch target: 44×44pt (Apple HIG + Android Material)

Text:
  → Never hardcode font sizes — use dynamic type (allowFontScaling={true} is default, do NOT set false)
  → Color contrast: 4.5:1 minimum for body text

Screen readers:
  → Test with VoiceOver (iOS) and TalkBack (Android) before every release
  → importantForAccessibility="no" to hide decorative elements
```

---

## EAS Build + Submit CI/CD

```json
// eas.json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": { "appleId": "christopher@nexoflow.co.uk", "ascAppId": "APP_ID" },
      "android": { "serviceAccountKeyPath": "./google-service-account.json", "track": "internal" }
    }
  }
}
```

---

## Related
- [[NexoFlow System/Playbooks/Mobile App Build Playbook]]
- [[Maps of Content/Mobile Apps MOC]]
- [[NexoFlow System/Knowledge and Tech/Desktop Engineering Standards]]
- [[NexoFlow System/Quality Assurance Framework]]
