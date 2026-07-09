# SigmaBrain Agent Reservation Board

## Zweck

Dieses Dokument ist das operative Register für parallele Agentenarbeit.
Jeder Agent reserviert genau einen klaren Work Package-Block oder einen klaren Subtask.

## Ziel

- verhindern, dass zwei Agenten denselben Bereich gleichzeitig bearbeiten
- sichtbare Ownership für laufende Arbeit
- klare Übergabe und Freigabe

## Reservierungsregeln

1. Ein Block darf immer nur einen aktiven Owner haben.
2. Ein Agent reserviert nur einen Block gleichzeitig, außer er ist Integrator oder Reviewer.
3. Wenn ein Block reserviert ist, darf kein anderer Agent denselben Dateiscope bearbeiten.
4. Eine Reservierung muss vor der Implementierung gesetzt werden.
5. Nach Abschluss muss die Reservierung explizit freigegeben werden.

## Statuswerte

- `free`
- `reserved`
- `in_progress`
- `blocked`
- `ready_for_review`
- `merged`
- `released`

## Pflichtfelder pro Eintrag

- Work Package ID
- Block oder Subtask Name
- Owner Agent
- Status
- Startzeit
- Letzte Aktualisierung
- Betroffene Dateien
- Betroffene APIs
- Betroffene Events
- Blocker
- Nächster Schritt

## Reservierungsablauf

1. Work Package auswählen
2. Block/Teilblock festlegen
3. Dateien und Grenzen eintragen
4. Status auf `reserved` setzen
5. Arbeit beginnen und Status auf `in_progress` setzen
6. Bei Blocker auf `blocked` setzen
7. Bei Fertigstellung auf `ready_for_review` setzen
8. Nach Merge auf `merged` setzen
9. Nach Release auf `released` setzen

## Konfliktregel

- Wenn zwei Reservierungen kollidieren, gewinnt die ältere und engere Reservierung.
- Der spätere Agent muss auf einen freien Subblock ausweichen oder pausieren.
- Bei unklarer Kollision entscheidet der Integrator.

## Empfohlene Block-Einteilung

- `WP-001` bis `WP-010` als einzelne Blöcke
- Phase-1 Desktop WPs als einzelne Blöcke
- Phase-2 Memory/Graph/Connector WPs als einzelne Blöcke
- Phase-3 Runtime/Plugin/Marketplace WPs als einzelne Blöcke
- Phase-4 Oversight/Worker/Mission WPs als einzelne Blöcke

## Praktische Nutzung

Der Agent liest dieses Dokument vor dem Arbeiten, trägt sich ein, arbeitet nur im reservierten Scope und gibt den Block danach wieder frei.

---

## Aktive Reservierungen

### Agent 07 - Desktop Write/Release (WP-108, WP-109, WP-110)

- **Owner Agent:** Agent 07 (Cascade)
- **Status:** `ready_for_review`
- **Startzeit:** 2026-07-09 00:00 UTC+02
- **Letzte Aktualisierung:** 2026-07-09 00:30 UTC+02
- **Betroffene Dateien:**
  - `src/desktop/writeback/types.ts`, `service.ts`, `index.ts`
  - `src/core/render/index.ts`
  - `src/core/exporter/index.ts`
  - `src/app/api/writeback/route.ts`, `[id]/route.ts`, `[id]/preview/route.ts`, `[id]/approve/route.ts`, `[id]/reject/route.ts`, `[id]/cancel/route.ts`, `[id]/execute/route.ts`
  - `apps/desktop/update/types.ts`, `signature.ts`, `manager.ts`, `index.ts`
  - `src/desktop/approval/types.ts`, `service.ts`, `index.ts`
  - `src/ui/approval/approval-inbox.tsx`, `index.ts`
  - `tests/unit/render.test.ts`, `export.test.ts`, `writeback.test.ts`, `signature.test.ts`, `update-manager.test.ts`, `approval-inbox.test.ts`
- **Betroffene APIs:** `writeBack.create/approve/reject/cancel/execute/preview/get/list`, `approvalInbox.list/approve/reject/get/pendingCount`, `UpdateManager.checkForUpdates/downloadUpdate/verifyUpdate/installUpdate/rollbackUpdate`
- **Betroffene Events:** `WriteBackRequested`, `WriteBackCompleted`, `WriteBackFailed`, `UpdateAvailable`, `UpdateVerified`, `UpdateInstalled`, `UpdateRolledBack`, `ApprovalInboxOpened`, `ApprovalViewed`, `ApprovalDecisionSubmitted`
- **Blocker:** Tauri Runtime Bridge (installFn, rollbackFn, writeFn) von Agent 04 ausstehend; Folder Authorization Integration mit Agent 05 ausstehend
- **Nächster Schritt:** Integrator-Review; Koordination mit Agent 04 für Tauri Bridge; E2E Test
- **Tests:** 52 pass, 0 fail, 124 expect() calls across 6 files

### WP-101: Tauri Desktop Shell

- **Owner Agent**: Cascade (Agent 04)
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-08 23:20 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:30 UTC+02
- **Betroffene Dateien**: `src-tauri/**`, `src/desktop/**` (types, events, runtime, store, shell-provider, desktop-shell, shell-loading-screen, use-desktop, index), `src/app/layout.tsx`, `next.config.ts`, `package.json`
- **Betroffene APIs**: `get_shell_info`, `shell_ready` (Tauri commands)
- **Betroffene Events**: `DesktopShellStarted`, `DesktopShellReady`, `DesktopShellClosing`
- **Nächster Schritt**: Integrator Review + Merge

### WP-104: Folder Authorization

- **Owner Agent**: Cascade
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 01:10 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:42 UTC+02
- **Betroffene Dateien**: `src/core/path-utils.ts`, `src/desktop/folder-auth/**` (types, grant-store, folder-auth-service, events, use-folder-auth, index, test)
- **Betroffene APIs**: `authorizeFolder(path)`, `revokeFolder(path)`, `listAuthorizedFolders()`, `isAuthorized(path)`, `isPathAuthorized(path)`
- **Betroffene Events**: `folder-authorized`, `folder-revoked`, `folder-authorization-denied`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge

### WP-105: File Watcher

- **Owner Agent**: Cascade
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 01:30 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:48 UTC+02
- **Betroffene Dateien**: `src/core/watch-types.ts`, `src/desktop/file-watcher/**` (watcher-service, events, use-file-watcher, index, test)
- **Betroffene APIs**: `startWatcher(paths)`, `stopWatcher()`, `onFileEvent(callback)`, `setConfig(config)`, `isPathWatched(path)`, `shouldIgnore(path)`, `emitChange(path, changeType, size?)`
- **Betroffene Events**: `file-observed`, `file-changed`, `file-removed`, `file-ignored`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge

### WP-103: OS Keychain Integration

- **Owner Agent**: Cascade
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 00:30 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:37 UTC+02
- **Betroffene Dateien**: `src/core/secure-store-types.ts`, `src/desktop/keychain/**` (tauri-adapter, fallback-adapter, adapter-factory, events, store, use-keychain, index, test), `src-tauri/src/keychain.rs`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `bunfig.toml`
- **Betroffene APIs**: `saveSecret(key, value)`, `loadSecret(key)`, `deleteSecret(key)`, `hasSecret(key)`, `listSecrets()`, `isKeychainAvailable()`
- **Betroffene Events**: `secret-stored`, `secret-loaded`, `secret-deleted`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge, dann WP-102 (Desktop Auth/Session) freigeben

### WP-102: Desktop Auth Session

- **Owner Agent**: Cascade
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 00:50 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 01:10 UTC+02
- **Betroffene Dateien**: `src/core/session-types.ts`, `src/desktop/auth/**` (auth-service, store, events, use-auth, index)
- **Betroffene APIs**: `login(credentials)`, `restoreSession()`, `logout()`, `getSessionToken()`, `isAuthenticated()`
- **Betroffene Events**: `DesktopSessionStarted`, `DesktopSessionRestored`, `DesktopSessionEnded` (event listener infrastructure)
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge

### WP-106: Local Ingest Queue

- **Owner Agent**: Cascade
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 00:36 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:56 UTC+02
- **Betroffene Dateien**: `src/core/ingest-types.ts`, `src/desktop/ingest/**` (types, queue-store, ingest-service, index), `src/desktop/ingest-queue/**` (ingest-queue-service, store, events, use-ingest-queue, index, test), `tests/unit/ingest-queue.test.ts`
- **Betroffene APIs**: `enqueueIngest(item)`, `dequeueIngest()`, `ackIngest(id)`, `failIngest(id, error)`, `requeueStale()`, `stats()`, `getPendingJobs()`, `getFailedJobs()`, `clearCompleted()`, `clearAll()`
- **Betroffene Events**: `ingest-queued`, `ingest-started`, `ingest-completed`, `ingest-failed`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge
- **Tests**: 16 pass, 0 fail

### WP-107: Local Search Cache

- **Owner Agent**: Cascade (Agent 07)
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 00:40 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 00:56 UTC+02
- **Betroffene Dateien**: `src/desktop/search/**` (types, search-service, events, index), `tests/unit/search-cache.test.ts`
- **Betroffene APIs**: `indexDocument(doc)`, `searchLocal(query)`, `rebuildIndex(scope)`, `invalidateDocument(slug)`, `stats()`
- **Betroffene Events**: `document-indexed`, `index-rebuilt`, `search-cache-invalidated`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge
- **Tests**: 19 pass, 0 fail
- **Performance**: p95 < 150ms on 100 docs confirmed

### WP-306: Plugin SDK v0

- **Owner Agent**: Cascade (Agent 07)
- **Status**: `ready_for_review`
- **Startzeit**: 2026-07-09 02:53 UTC+02
- **Letzte Aktualisierung**: 2026-07-09 03:10 UTC+02
- **Betroffene Dateien**: `plugins/sdk/**` (types, validate, store, lifecycle, index), `tests/unit/plugin-sdk.test.ts`
- **Betroffene APIs**: `loadPlugin(manifest)`, `enablePlugin(id)`, `disablePlugin(id)`, `sandboxPlugin(id, level)`, `removePlugin(id)`, `hasCapability(id, cap)`, `recordViolation(id, violation)`, `updateConfig(id, config)`
- **Betroffene Events**: `plugin-installed`, `plugin-enabled`, `plugin-disabled`, `plugin-sandbox-violation`, `plugin-error`
- **Blocker**: keine
- **Nächster Schritt**: Integrator Review + Merge
- **Tests**: 32 pass, 0 fail
