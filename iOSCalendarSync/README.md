# iOS Calendar Sync

A native iOS app that syncs events between your iOS calendars using EventKit.

## Features

- **Sync Rules** — Create rules to sync events between any two calendars on your device
- **One-way & Two-way Sync** — Choose the direction that suits your workflow
- **Duplicate Handling** — Skip duplicates, overwrite with source, or keep both copies
- **Deletion Propagation** — Optionally propagate event deletions to the destination calendar
- **Date Range Control** — Specify how many days in the past and future to sync
- **Background Sync** — Automatic sync every 15 minutes via BGAppRefreshTask
- **Sync History** — Full log of every sync operation with per-event details
- **Cancel at any time** — Cancel an in-progress sync with a tap

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Setup

1. Clone the repository
2. Open `iOSCalendarSync.xcodeproj` in Xcode
3. Select your development team in **Signing & Capabilities**
4. Update the Bundle Identifier (`com.example.iOSCalendarSync` → your own)
5. Run on a real device (EventKit requires physical hardware for testing)

## Architecture

```
iOSCalendarSync/
├── App/
│   ├── iOSCalendarSyncApp.swift   # @main entry point, injects environment objects
│   └── AppDelegate.swift          # Background task registration & scheduling
├── Models/
│   ├── SyncRule.swift             # Rule config + UserDefaults persistence
│   └── SyncResult.swift           # Sync outcome + history persistence
├── Managers/
│   ├── CalendarManager.swift      # EventKit wrapper (authorization, CRUD)
│   └── SyncManager.swift          # Sync orchestration with async/await
└── Views/
    ├── ContentView.swift          # Tab bar + permission request screen
    ├── SyncRulesView.swift        # Rules list with inline sync controls
    ├── SyncRuleDetailView.swift   # Add/edit rule form
    ├── SyncHistoryView.swift      # Sync history + per-event detail
    ├── CalendarListView.swift     # Browse available calendars
    └── SettingsView.swift         # Authorization status, data management
```

## How Sync Works

1. **Source events** are fetched for the configured date range
2. **Destination events** are scanned for a hidden sync tag in their notes field
   (`[CalendarSync-Source:<eventIdentifier>]`)
3. Events not yet in the destination are **copied** with the tag embedded
4. Already-synced events are handled per the **duplicate policy** (skip / overwrite / keep both)
5. If deletion propagation is on, destination events whose source no longer exists are **removed**
6. All changes are committed in a single `EKEventStore.commit()` call

For **two-way** rules the same process runs in reverse (destination → source).

## Permissions

The app requests **Full Calendar Access** (`NSCalendarsFullAccessUsageDescription`), required to read and write events. The reason is displayed to the user when the system permission dialog is shown.

Background sync requires **Background App Refresh** to be enabled for the app in iOS Settings.

## Tests

Unit tests live in `iOSCalendarSyncTests/CalendarSyncTests.swift` and cover:
- `SyncRule` default values, date range calculation, persistence
- `SyncResult` summary generation, total counts, history persistence
- Enum display name coverage

Run with `Cmd+U` in Xcode (on simulator; EventKit interactions are tested on device).
