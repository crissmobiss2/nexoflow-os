---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, desktop, playbook, tauri, electron, macos, windows]
---

# Desktop App Build Playbook

> *NexoFlow's execution guide for desktop applications. Tauri-first, production-grade, signed and distributed properly. Desktop is a premium opportunity — few studios do it well.*

---

## When to Build Desktop

Desktop is the right answer when the web genuinely cannot do the job:

```
□ Needs persistent background processes (file watcher, sync daemon, tray app)
□ Needs deep file system access (read/write arbitrary directories, folder watching)
□ Needs native OS integration (keyboard shortcuts, notifications, dock/taskbar)
□ Local-first is the primary architecture (data lives on the machine)
□ Performance-critical operations on large local datasets
□ Local AI/LLM inference (Ollama, on-device models)
□ Security: data must never leave the device
□ Offline-first as a hard requirement, not a nice-to-have
```

If none of these apply: build a web app. Desktop adds cost, complexity, and maintenance overhead. It must earn its place.

---

## Stack Selection

```
Default: Tauri v2
  → Rust backend (tauri-src/) + React/TypeScript/Vite frontend
  → ~5-15MB bundle (vs Electron's ~150MB)
  → Better security posture (no Node.js in renderer, CSP enforced)
  → Cross-platform: macOS + Windows + Linux from one codebase

Use Electron when:
  → Heavy Node.js ecosystem dependency (e.g., headless Chrome via Playwright)
  → Team has no Rust familiarity AND the project timeline is too tight to learn
  → Client already has Electron codebase that needs extension

Use native (SwiftUI / WPF / WinUI) when:
  → macOS-only or Windows-only AND deep platform API required
  → Very large engineering team with platform expertise
  → (NexoFlow: almost never — cross-platform Tauri is the right call)
```

---

## Phase 1 — Discovery (1–3 days)

```
□ Platform targets: macOS only / Windows only / both / Linux too
□ Distribution: direct download / Mac App Store / Windows Store / enterprise MDM
□ Local data requirements: what data lives on device, how much, what format
□ Online requirements: fully offline / sync when online / requires always-on
□ Background processes: what runs when the window is closed?
□ Auto-update: required? User-controlled or automatic?
□ Code signing: client has Apple Developer cert? Windows EV cert?
  → Apple Developer Program: $99/year (required for notarization)
  → Windows EV Code Signing cert: $200-$400/year (required for SmartScreen trust)
□ Existing desktop app? (migration vs. new build)
□ Internal tool or commercial product? (changes distribution requirements)
```

---

## Phase 2 — Architecture

### Project Structure
```
my-app/
├── src/                     # React frontend (TypeScript + Vite)
│   ├── routes/              # Pages/screens
│   ├── components/          # UI components
│   ├── stores/              # Zustand state
│   ├── hooks/               # Custom hooks
│   └── lib/
│       ├── ipc.ts           # All Tauri invoke() calls — typed
│       └── db.ts            # Frontend DB access (if SQLite from renderer)
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── main.rs          # App entry, window config, tray setup
│   │   ├── commands.rs      # All #[tauri::command] handlers
│   │   ├── db.rs            # SQLite operations (sqlx)
│   │   └── fs.rs            # File system operations
│   ├── tauri.conf.json      # App config, permissions, updater
│   └── Cargo.toml           # Rust dependencies
└── package.json
```

### IPC Pattern — The Only Way to Talk to Rust
```typescript
// lib/ipc.ts — typed wrappers around all Tauri commands
import { invoke } from '@tauri-apps/api/core'

export const ipc = {
  // Every command gets a typed wrapper
  async readDirectory(path: string): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('read_directory', { path })
  },
  
  async processFile(path: string, options: ProcessOptions): Promise<ProcessResult> {
    return invoke<ProcessResult>('process_file', { path, options })
  },
}

// RULE: Never call invoke() directly in components. Always through ipc.ts.
// This gives us a single place to add error handling, logging, and mocking.
```

```rust
// commands.rs
#[tauri::command]
async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    // All file system ops, DB queries, and sensitive work happen here
    // Never in the renderer (frontend)
    fs::read_dir_typed(&path).map_err(|e| e.to_string())
}
```

### Local Database (SQLite)
```rust
// db.rs — sqlx + SQLite
use sqlx::{sqlite::SqlitePool, Pool, Sqlite};

pub async fn init_db(app_data_dir: &str) -> Pool<Sqlite> {
    let db_path = format!("{}/app.db", app_data_dir);
    let pool = SqlitePool::connect(&format!("sqlite://{}?mode=rwc", db_path))
        .await
        .expect("Failed to connect to database");
    
    sqlx::migrate!("./migrations").run(&pool).await.expect("Migration failed");
    pool
}
// Use sqlx::query_as! macro for type-safe queries
// Run migrations from migrations/ directory (same as web Drizzle migrations)
```

### Window State Persistence
```rust
// Remember window size and position between sessions
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
// In main.rs:
app.restore_state(StateFlags::all()).ok();
```

---

## Phase 3 — Core Build

### Keyboard Shortcut System
```typescript
// Every desktop app needs a keyboard shortcut system
import { useEffect } from 'react'

function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey // Cmd on Mac, Ctrl on Windows
      
      if (meta && e.key === 'k') { e.preventDefault(); openCommandPalette() }
      if (meta && e.key === ',') { e.preventDefault(); openSettings() }
      if (meta && e.key === 'n') { e.preventDefault(); createNew() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
}
```

### Command Palette (must-have for productivity apps)
```typescript
// Use cmdk library — battle-tested command palette
import { Command } from 'cmdk'

// Triggered by Cmd+K — shows all available actions, searchable
// Every feature should be accessible through the command palette
// Improves discoverability, power-user workflows, and accessibility
```

### System Tray (when app runs in background)
```rust
// src-tauri/src/main.rs
use tauri::{SystemTray, SystemTrayMenu, CustomMenuItem, SystemTrayEvent};

fn build_tray() -> SystemTray {
    let show = CustomMenuItem::new("show", "Show App");
    let quit = CustomMenuItem::new("quit", "Quit");
    let menu = SystemTrayMenu::new().add_item(show).add_item(quit);
    SystemTray::new().with_menu(menu)
}
```

### Auto-Updater Setup
```json
// tauri.conf.json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": ["https://releases.your-app.com/{{target}}/{{current_version}}"],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```
```
Release endpoint returns JSON:
{
  "version": "1.2.0",
  "notes": "Bug fixes",
  "pub_date": "2026-01-01T00:00:00Z",
  "url": "https://releases.your-app.com/v1.2.0/your-app-macos.tar.gz",
  "signature": "CONTENT_SIGNATURE"
}
GitHub Releases works as the update server with the tauri-action GitHub Action.
```

---

## Phase 4 — Code Signing + Packaging

### macOS Code Signing + Notarization
```bash
# Required for distribution outside Mac App Store
# Without notarization: Gatekeeper blocks the app (users see scary warning)

# In GitHub Actions (using tauri-action):
APPLE_CERTIFICATE         # Developer ID Application certificate (base64)
APPLE_CERTIFICATE_PASSWORD
APPLE_SIGNING_IDENTITY    # "Developer ID Application: Your Name (TEAMID)"
APPLE_ID                  # Apple ID email
APPLE_PASSWORD            # App-specific password from appleid.apple.com
APPLE_TEAM_ID

# tauri-action handles signing and notarization automatically with these secrets
```

### Windows Code Signing
```bash
# Required to prevent Windows SmartScreen "Unknown Publisher" warning
# EV (Extended Validation) cert required to bypass SmartScreen entirely
# Cost: ~$200-$400/year from DigiCert, Sectigo, GlobalSign

WINDOWS_CERTIFICATE       # PFX file (base64)
WINDOWS_CERTIFICATE_PASSWORD

# tauri-action handles signing with these secrets
```

### Release Pipeline (GitHub Actions)
```yaml
# .github/workflows/release.yml
on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        platform: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: tauri-apps/tauri-action@v0
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'App v__VERSION__'
          releaseBody: 'See CHANGELOG.md'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          # ... other signing secrets
```

---

## Phase 5 — Premium Desktop UX (Polish Sprint)

```
□ Dark mode: auto-follow system preference (CSS: @media (prefers-color-scheme: dark))
□ Window title bar: custom title bar on Windows, native on macOS
□ Native context menus: right-click shows OS-native context menu (not web dropdown)
□ Drag and drop: files draggable onto window trigger operations
□ File associations: app registers as handler for specific file types
□ Dock/taskbar badge: notification count visible in OS dock
□ Accessibility: keyboard navigation through all UI, proper ARIA roles
□ Responsive to window resize: layout adapts from compact to wide
□ Loading: local operations must be instant (<100ms) — no spinners for DB queries
□ Onboarding: first-launch wizard for initial setup, never shown again
□ App icon: proper .icns (macOS) and .ico (Windows) with all required sizes
```

---

## Performance Benchmarks

| Metric | Target |
|---|---|
| App launch (cold start) | <2 seconds |
| App launch (warm, Dock click) | <0.5 seconds |
| Bundle size | <15MB (Tauri) |
| Memory at idle | <100MB |
| DB query response | <50ms for local queries |
| File operations | Progress indicator if >500ms |
| Auto-update download | Background, non-blocking |

---

## Related
- [[NexoFlow System/Knowledge and Tech/Desktop Engineering Standards]]
- [[Maps of Content/Desktop Apps MOC]]
- [[NexoFlow System/Playbooks/Mobile App Build Playbook]]
- [[NexoFlow System/NexoFlow Services]]
