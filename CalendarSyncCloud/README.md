# Calendar Sync Cloud

A self-hosted cloud app to link and sync calendars across **Google Calendar**, **Microsoft 365**, and **Apple Calendar (iCloud)**.

## Features

- **OAuth2** for Google and Microsoft 365
- **CalDAV** for Apple iCloud Calendar
- **One-way or two-way** sync between any calendars across platforms
- **Configurable** sync window (days back/forward), duplicate handling, deletion propagation
- **Background auto-sync** via cron (default: every 15 minutes)
- **Full sync history** with per-operation event counts
- **Dark-mode web UI** — Dashboard, Connections, Rules, History

## Quick Start

### Development

```bash
# Backend
cd backend
cp .env.example .env   # fill in OAuth credentials
npm install
npm run dev            # runs on http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # runs on http://localhost:5173
```

### Production (Docker)

```bash
cp backend/.env.example .env
# Edit .env with your credentials

docker compose up -d
# App available at http://localhost
```

## OAuth Setup

### Google Calendar
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add redirect URI: `http://localhost:3001/auth/google/callback` (dev) or `http://your-domain/auth/google/callback` (prod)
4. Enable the **Google Calendar API**
5. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`

### Microsoft 365
1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory → App registrations
2. New registration → set redirect URI to `http://localhost:3001/auth/microsoft/callback`
3. Under API Permissions, add `Calendars.ReadWrite` and `User.Read` (delegated)
4. Create a client secret under Certificates & secrets
5. Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in `.env`

### Apple Calendar (iCloud)
1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Generate a new app-specific password
3. In the app UI → Connections → Apple Calendar, enter your Apple ID email and the app-specific password

## Architecture

```
CalendarSyncCloud/
├── backend/                    # Node.js + Express + TypeScript
│   └── src/
│       ├── db.ts               # SQLite schema (better-sqlite3)
│       ├── types.ts            # Shared TypeScript interfaces
│       ├── app.ts              # Express app setup
│       ├── server.ts           # Entry point + cron scheduler
│       ├── routes/
│       │   ├── auth.ts         # OAuth2 + CalDAV auth flows
│       │   ├── calendars.ts    # Calendar discovery & refresh
│       │   └── sync.ts         # Sync rules, triggers, history
│       └── services/
│           ├── encryption.ts   # AES-256-GCM token encryption
│           ├── google-service.ts      # Google Calendar API
│           ├── microsoft-service.ts   # Microsoft Graph API
│           ├── apple-service.ts       # CalDAV (tsdav)
│           └── sync-engine.ts         # Core sync logic
├── frontend/                   # React + TypeScript + Vite
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx   # Stats + recent activity
│       │   ├── Connections.tsx # Provider OAuth connect/disconnect
│       │   ├── SyncRules.tsx   # Rule management + manual sync
│       │   └── History.tsx     # Full sync history log
│       └── api/client.ts       # Axios API client
└── docker-compose.yml
```

## Sync Logic

1. Fetch all events from source calendar (within configured date window)
2. Load existing event mappings for this rule from the database
3. For each source event:
   - **No mapping**: create in destination → store mapping
   - **Has mapping, etag changed**: update destination → update mapping
   - **Has mapping, unchanged**: skip
4. For deleted source events (if `deletionHandling = propagate`): delete destination event
5. For **two-way** rules: repeat the above in reverse direction

Event identity is tracked in the `event_mappings` table linking source ↔ destination event IDs per sync rule.

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Backend port (default: 3001) |
| `SESSION_SECRET` | Express session secret |
| `ENCRYPTION_KEY` | 64-char hex key for token encryption |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth callback URL |
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app client secret |
| `MICROSOFT_REDIRECT_URI` | Microsoft OAuth callback URL |
| `SYNC_INTERVAL_MINUTES` | Background sync interval (0 = off) |
| `FRONTEND_URL` | Frontend origin for CORS |
| `DB_PATH` | SQLite database file path |
