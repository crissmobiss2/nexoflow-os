---
created: 2026-05-18
modified: 2026-05-18
tags: [nexoflow, desktop, standards, tauri, electron, engineering]
status: canonical
---

# Desktop Engineering Standards

> *NexoFlow's canonical standards for desktop application development. Tauri v2 is the default. These are the rules — deviations need a DECL entry.*

---

## Stack Declaration

**Primary framework:** Tauri v2  
**Frontend:** React 18 + TypeScript strict + Vite + Tailwind v4  
**UI components:** shadcn/ui (adapted for desktop density)  
**State:** Zustand  
**IPC:** Tauri commands (`invoke()`) — all Rust-side, typed TypeScript wrappers  
**Database:** SQLite via sqlx (Rust) — managed in Tauri backend, never frontend  
**Auto-update:** Tauri Updater plugin + GitHub Releases  
**Packaging:** `tauri build` — produces DMG (macOS), MSI/NSIS (Windows), AppImage (Linux)  
**Code signing:** tauri-action GitHub Action with Apple + Windows signing secrets  
**Error monitoring:** Sentry (web SDK in renderer + Rust panic hooks in backend)  
**Analytics:** PostHog (privacy-first, self-hosted option)

---

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Project Structure

```
src/                        # React frontend (TypeScript + Vite)
  routes/                   # TanStack Router pages (file-based preferred)
  components/
    ui/                     # shadcn-adapted primitives
    desktop/                # Desktop-specific (CommandPalette, TitleBar, Tray)
  hooks/
  stores/                   # Zustand stores
  lib/
    ipc.ts                  # ALL Tauri invoke() calls — typed, no raw invoke elsewhere
    db.ts                   # DB query wrappers (if accessing from frontend via IPC)
    shortcuts.ts            # Keyboard shortcut registry
src-tauri/
  src/
    main.rs                 # App init, window setup, tray, event handlers
    commands.rs             # All #[tauri::command] functions
    db.rs                   # SQLite connection pool + queries
    fs.rs                   # File system operations
    updater.rs              # Update check logic
  migrations/               # SQL migration files (*.sql)
  icons/                    # App icons (all required sizes)
  tauri.conf.json           # App config
  Cargo.toml
```

---

## IPC Standard — Single Source of Truth

```typescript
// lib/ipc.ts — CANONICAL pattern
// RULE: Never call invoke() directly outside this file.
import { invoke } from '@tauri-apps/api/core'

// Every command gets a typed async wrapper
export const ipc = {
  // File system
  async listDirectory(path: string): Promise<FileEntry[]> {
    return invoke<FileEntry[]>('list_directory', { path })
  },
  async readFile(path: string): Promise<string> {
    return invoke<string>('read_file', { path })
  },
  async writeFile(path: string, content: string): Promise<void> {
    return invoke<void>('write_file', { path, content })
  },

  // Database
  async queryItems<T>(query: string, params: unknown[]): Promise<T[]> {
    return invoke<T[]>('query_items', { query, params })
  },
}
```

```rust
// commands.rs — all commands are async, return Result<T, String>
use tauri::command;

#[command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    crate::fs::list_dir(&path).await.map_err(|e| e.to_string())
}

#[command]  
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

// RULE: All I/O, DB queries, and sensitive ops live here.
// The frontend (renderer) never has direct FS or DB access.
```

---

## Database Standard (SQLite + sqlx)

```rust
// db.rs — connection pool, migrations, typed queries
use sqlx::{sqlite::SqlitePool, Pool, Sqlite, Row};

pub type DbPool = Pool<Sqlite>;

pub async fn init(app_data_dir: &str) -> DbPool {
    let db_path = format!("{}/data.db", app_data_dir);
    let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path))
        .await
        .expect("DB connection failed");
    
    sqlx::migrate!("./migrations").run(&pool).await.expect("Migration failed");
    pool
}

// Typed query example
pub async fn get_items(pool: &DbPool, limit: i64) -> Result<Vec<Item>, sqlx::Error> {
    sqlx::query_as!(Item, "SELECT * FROM items ORDER BY created_at DESC LIMIT ?", limit)
        .fetch_all(pool)
        .await
}
```

**Migration naming:** `migrations/0001_init.sql`, `0002_add_tags.sql` — sequential, never edit existing.

---

## Security Standards

```
1. CSP (Content Security Policy): configured in tauri.conf.json
   → "default-src 'self'; script-src 'self'; connect-src 'self' https://api.yourapp.com"
   → No 'unsafe-inline', no 'unsafe-eval'

2. Capability model (Tauri v2): explicitly declare what the app can access
   → File system: only the directories actually needed
   → Network: only the domains actually needed
   → No over-provisioning

3. Never store secrets in the frontend code
   → API keys go in environment variables, injected at build time via EXPO_PUBLIC_ equivalent
   → Sensitive secrets go in Tauri backend (Rust) — inaccessible to renderer

4. Node.js integration: DISABLED in all webview contexts (Tauri default)
   → This is the #1 Electron security mistake — Tauri prevents it architecturally

5. Permissions in tauri.conf.json:
   → allowlist: list only what's needed
   → "all": false — never use wildcard permission
```

---

## Window Management Standard

```rust
// main.rs — window configuration
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build()) // persist state
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Minimum sensible window size
            window.set_min_size(Some(LogicalSize::new(800.0, 600.0))).ok();
            
            // Open devtools only in dev
            #[cfg(debug_assertions)]
            window.open_devtools();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

```typescript
// Keyboard shortcuts — must be registered globally in app root
import { register } from '@tauri-apps/api/globalShortcut'

const shortcuts = {
  'CommandOrControl+K': () => commandPaletteStore.open(),
  'CommandOrControl+,': () => navigate('/settings'),
  'CommandOrControl+Q': () => app.quit(), // handled by OS on macOS, explicit on Windows
}

// Register on mount, unregister on unmount
```

---

## Desktop UX Requirements

Every NexoFlow desktop app must ship with:

```
□ Command palette (Cmd/Ctrl+K) — every action discoverable by text search
□ Keyboard shortcuts — documented in Help menu, shown in UI where relevant
□ Window state persistence — size, position, last active state remembered
□ Dark mode — automatic, follows system preference via CSS media query
□ Native context menu — right-click on content opens OS context menu, not web dropdown
□ Drag and drop — file drag into window triggers appropriate action
□ App icon — full icon set (macOS .icns with 1024px max, Windows .ico with 256px max)
□ About window — app name, version, license, support link
□ Keyboard navigation — full app navigable without mouse
□ Undo/Redo — for any destructive or modifying actions
□ Auto-save — for any editing workflow (no manual Save button)
□ First-launch onboarding — shown once, skippable, never shown again
```

---

## Release Workflow

```
Development:
  tauri dev        → hot reload, devtools open, debug logging

Preview:
  tauri build      → optimized build locally, test signing
  Upload to GitHub draft release, share DMG/MSI for testing

Production:
  git tag v1.2.3
  git push --tags
  → GitHub Actions triggers tauri-action
  → Builds macOS (dmg) + Windows (msi + nsis) + Linux (appimage)
  → Signs with certs from GitHub Secrets
  → Publishes to GitHub Releases
  → Auto-update endpoint returns new version → users prompted
```

---

## Performance Requirements

| Metric | Standard |
|---|---|
| Cold start | <2 seconds |
| Hot start (re-open) | <500ms |
| Memory at idle | <120MB |
| Bundle size | <15MB |
| UI responsiveness | Never block main thread >16ms |
| DB queries | <50ms for all local queries |
| File operations | Non-blocking (async in Rust) |

---

## Related
- [[NexoFlow System/Playbooks/Desktop App Build Playbook]]
- [[Maps of Content/Desktop Apps MOC]]
- [[NexoFlow System/Knowledge and Tech/Mobile Engineering Standards]]
- [[NexoFlow System/Standards/NexoFlow Standards]]
