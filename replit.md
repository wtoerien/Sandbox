# Accounting Workflow - Replit Project

## Overview
This project contains two applications:
1. **accounting-workflow** - A Next.js 16 web app for accounting practice management
2. **iOSCalendarSync** - A native iOS app (Swift/SwiftUI) for calendar sync (not runnable in this environment)

## Accounting Workflow App

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Frontend**: React 19, Tailwind CSS 4
- **Backend**: Next.js Server Actions
- **Database**: SQLite via LibSQL + Prisma ORM
- **Auth**: Custom JWT + bcryptjs

### Key Files
- `accounting-workflow/src/app/` - Next.js App Router pages
- `accounting-workflow/src/lib/db.ts` - Database connection (uses local SQLite file)
- `accounting-workflow/src/lib/auth.ts` - Authentication utilities
- `accounting-workflow/src/lib/seed.ts` - Database seeding (auto-seeds on first run)
- `accounting-workflow/prisma/schema.prisma` - Database schema
- `accounting-workflow/prisma/dev.db` - SQLite database file

### Configuration
- Runs on port 5000 (dev and production)
- Uses `file:prisma/dev.db` for the SQLite database (hardcoded to avoid Replit's PostgreSQL DATABASE_URL)
- JWT_SECRET env var set for authentication
- `allowedDevOrigins: ["*"]` in next.config.ts to allow Replit proxy

### Default Login
After first run, the app auto-seeds with:
- Email: `admin@demopractice.com`
- Password: `password`

### Running
The workflow `Start application` runs: `cd accounting-workflow && npm run dev`

### Deployment
Configured for autoscale deployment:
- Build: `cd accounting-workflow && npm run build`
- Run: `cd accounting-workflow && npm run start`
