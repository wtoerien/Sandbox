import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/calendar-sync.db';
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry INTEGER,
    caldav_username TEXT,
    caldav_password TEXT,
    caldav_server_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    timezone TEXT,
    read_only INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL,
    UNIQUE(connection_id, external_id)
  );

  CREATE TABLE IF NOT EXISTS sync_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_calendar_id TEXT NOT NULL,
    destination_calendar_id TEXT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'one_way',
    enabled INTEGER NOT NULL DEFAULT 1,
    sync_days_back INTEGER NOT NULL DEFAULT 30,
    sync_days_forward INTEGER NOT NULL DEFAULT 365,
    duplicate_handling TEXT NOT NULL DEFAULT 'skip',
    deletion_handling TEXT NOT NULL DEFAULT 'ignore',
    last_sync_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS event_mappings (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL REFERENCES sync_rules(id) ON DELETE CASCADE,
    source_event_id TEXT NOT NULL,
    destination_event_id TEXT NOT NULL,
    source_calendar_id TEXT NOT NULL,
    destination_calendar_id TEXT NOT NULL,
    source_etag TEXT,
    destination_etag TEXT,
    last_synced_at INTEGER NOT NULL,
    UNIQUE(rule_id, source_event_id, source_calendar_id)
  );

  CREATE TABLE IF NOT EXISTS sync_history (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'running',
    events_added INTEGER NOT NULL DEFAULT 0,
    events_updated INTEGER NOT NULL DEFAULT 0,
    events_deleted INTEGER NOT NULL DEFAULT 0,
    events_skipped INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
  );
`);

export default db;
