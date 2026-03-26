import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import {
  SyncRule, Calendar, UnifiedEvent, CreateEventPayload,
  EventMapping, SyncHistory, Provider,
} from '../types.js';
import * as googleService from './google-service.js';
import * as microsoftService from './microsoft-service.js';
import * as appleService from './apple-service.js';

// ── Provider dispatch helpers ──────────────────────────────────────────────

async function fetchEvents(
  provider: Provider,
  connectionId: string,
  calendarExternalId: string,
  timeMin: Date,
  timeMax: Date
): Promise<UnifiedEvent[]> {
  switch (provider) {
    case 'google':    return googleService.listEvents(connectionId, calendarExternalId, timeMin, timeMax);
    case 'microsoft': return microsoftService.listEvents(connectionId, calendarExternalId, timeMin, timeMax);
    case 'apple':     return appleService.listEvents(connectionId, calendarExternalId, timeMin, timeMax);
  }
}

async function createEvent(
  provider: Provider,
  connectionId: string,
  calendarExternalId: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  switch (provider) {
    case 'google':    return googleService.createEvent(connectionId, calendarExternalId, payload);
    case 'microsoft': return microsoftService.createEvent(connectionId, calendarExternalId, payload);
    case 'apple':     return appleService.createEvent(connectionId, calendarExternalId, payload);
  }
}

async function updateEvent(
  provider: Provider,
  connectionId: string,
  calendarExternalId: string,
  eventId: string,
  payload: CreateEventPayload,
  eventUrl?: string
): Promise<UnifiedEvent> {
  switch (provider) {
    case 'google':    return googleService.updateEvent(connectionId, calendarExternalId, eventId, payload);
    case 'microsoft': return microsoftService.updateEvent(connectionId, calendarExternalId, eventId, payload);
    case 'apple':     return appleService.updateEvent(connectionId, calendarExternalId, eventUrl || eventId, payload, eventId);
  }
}

async function deleteEvent(
  provider: Provider,
  connectionId: string,
  calendarExternalId: string,
  eventId: string,
  eventUrl?: string
): Promise<void> {
  switch (provider) {
    case 'google':    return googleService.deleteEvent(connectionId, calendarExternalId, eventId);
    case 'microsoft': return microsoftService.deleteEvent(connectionId, calendarExternalId, eventId);
    case 'apple':     return appleService.deleteEvent(connectionId, calendarExternalId, eventUrl || eventId);
  }
}

// ── Core one-directional sync ──────────────────────────────────────────────

interface SyncStats {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
}

async function syncDirection(
  rule: SyncRule,
  srcCal: Calendar,
  dstCal: Calendar,
  srcConnection: { id: string; provider: Provider },
  dstConnection: { id: string; provider: Provider },
  timeMin: Date,
  timeMax: Date,
  stats: SyncStats
): Promise<void> {
  // Fetch source events
  const sourceEvents = await fetchEvents(srcConnection.provider, srcConnection.id, srcCal.externalId, timeMin, timeMax);
  const sourceById = new Map(sourceEvents.map((e) => [e.id, e]));

  // Load existing mappings for this direction
  const mappings = db.prepare(
    'SELECT * FROM event_mappings WHERE rule_id = ? AND source_calendar_id = ? AND destination_calendar_id = ?'
  ).all(rule.id, srcCal.id, dstCal.id) as EventMapping[];
  const mappingBySourceId = new Map(mappings.map((m) => [m.sourceEventId, m]));

  // Process source events → create/update in destination
  for (const srcEvent of sourceEvents) {
    const existing = mappingBySourceId.get(srcEvent.id);
    const payload: CreateEventPayload = {
      title: srcEvent.title,
      description: srcEvent.description,
      location: srcEvent.location,
      startTime: srcEvent.startTime,
      endTime: srcEvent.endTime,
      isAllDay: srcEvent.isAllDay,
      recurrenceRules: srcEvent.recurrenceRules,
    };

    try {
      if (!existing) {
        // New event - create in destination
        const created = await createEvent(dstConnection.provider, dstConnection.id, dstCal.externalId, payload);
        db.prepare(
          'INSERT INTO event_mappings (id, rule_id, source_event_id, destination_event_id, source_calendar_id, destination_calendar_id, source_etag, destination_etag, last_synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), rule.id, srcEvent.id, created.id, srcCal.id, dstCal.id, srcEvent.etag, created.etag, Date.now());
        stats.added++;
      } else {
        // Check if source has changed
        const etagChanged = srcEvent.etag && existing.sourceEtag && srcEvent.etag !== existing.sourceEtag;
        const recentlySynced = Date.now() - existing.lastSyncedAt < 60_000; // within 1 minute

        if (!etagChanged && !recentlySynced) {
          stats.skipped++;
          continue;
        }

        if (rule.duplicateHandling === 'skip' && !etagChanged) {
          stats.skipped++;
          continue;
        }

        if (rule.duplicateHandling === 'overwrite' || etagChanged) {
          const updated = await updateEvent(
            dstConnection.provider, dstConnection.id, dstCal.externalId,
            existing.destinationEventId, payload, existing.destinationEventId
          );
          db.prepare(
            'UPDATE event_mappings SET source_etag = ?, destination_etag = ?, last_synced_at = ? WHERE id = ?'
          ).run(srcEvent.etag, updated.etag, Date.now(), existing.id);
          stats.updated++;
        } else {
          stats.skipped++;
        }
      }
    } catch (err) {
      console.error(`Failed to sync event ${srcEvent.id}:`, err);
      stats.skipped++;
    }
  }

  // Handle deletions - find mappings for events that no longer exist in source
  if (rule.deletionHandling === 'propagate') {
    for (const mapping of mappings) {
      if (!sourceById.has(mapping.sourceEventId)) {
        try {
          await deleteEvent(
            dstConnection.provider, dstConnection.id, dstCal.externalId,
            mapping.destinationEventId
          );
          stats.deleted++;
        } catch (err) {
          console.error(`Failed to delete destination event ${mapping.destinationEventId}:`, err);
        }
        db.prepare('DELETE FROM event_mappings WHERE id = ?').run(mapping.id);
      }
    }
  }
}

// ── Main sync function ─────────────────────────────────────────────────────

export async function performSync(ruleId: string): Promise<SyncHistory> {
  const rule = db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(ruleId) as Record<string, unknown>;
  if (!rule) throw new Error(`Sync rule ${ruleId} not found`);

  const syncRule: SyncRule = {
    id: rule.id as string,
    name: rule.name as string,
    sourceCalendarId: rule.source_calendar_id as string,
    destinationCalendarId: rule.destination_calendar_id as string,
    direction: rule.direction as SyncRule['direction'],
    enabled: !!(rule.enabled as number),
    syncDaysBack: rule.sync_days_back as number,
    syncDaysForward: rule.sync_days_forward as number,
    duplicateHandling: rule.duplicate_handling as SyncRule['duplicateHandling'],
    deletionHandling: rule.deletion_handling as SyncRule['deletionHandling'],
    createdAt: rule.created_at as number,
  };

  const historyId = uuidv4();
  const startedAt = Date.now();

  db.prepare(
    'INSERT INTO sync_history (id, rule_id, rule_name, started_at, status) VALUES (?, ?, ?, ?, ?)'
  ).run(historyId, syncRule.id, syncRule.name, startedAt, 'running');

  const stats: SyncStats = { added: 0, updated: 0, deleted: 0, skipped: 0 };

  try {
    const srcCal = db.prepare('SELECT * FROM calendars WHERE id = ?').get(syncRule.sourceCalendarId) as Record<string, unknown>;
    const dstCal = db.prepare('SELECT * FROM calendars WHERE id = ?').get(syncRule.destinationCalendarId) as Record<string, unknown>;

    if (!srcCal || !dstCal) throw new Error('Calendar not found');

    const srcConn = db.prepare('SELECT id, provider FROM connections WHERE id = ?').get(srcCal.connection_id as string) as { id: string; provider: Provider };
    const dstConn = db.prepare('SELECT id, provider FROM connections WHERE id = ?').get(dstCal.connection_id as string) as { id: string; provider: Provider };

    if (!srcConn || !dstConn) throw new Error('Connection not found');

    const srcCalTyped: Calendar = {
      id: srcCal.id as string,
      connectionId: srcCal.connection_id as string,
      externalId: srcCal.external_id as string,
      name: srcCal.name as string,
      readOnly: !!(srcCal.read_only as number),
      provider: srcCal.provider as Provider,
    };

    const dstCalTyped: Calendar = {
      id: dstCal.id as string,
      connectionId: dstCal.connection_id as string,
      externalId: dstCal.external_id as string,
      name: dstCal.name as string,
      readOnly: !!(dstCal.read_only as number),
      provider: dstCal.provider as Provider,
    };

    const now = new Date();
    const timeMin = new Date(now.getTime() - syncRule.syncDaysBack * 86_400_000);
    const timeMax = new Date(now.getTime() + syncRule.syncDaysForward * 86_400_000);

    // Forward sync: source → destination
    await syncDirection(syncRule, srcCalTyped, dstCalTyped, srcConn, dstConn, timeMin, timeMax, stats);

    // Reverse sync: destination → source (two-way only)
    if (syncRule.direction === 'two_way') {
      await syncDirection(syncRule, dstCalTyped, srcCalTyped, dstConn, srcConn, timeMin, timeMax, stats);
    }

    const completedAt = Date.now();
    db.prepare(
      'UPDATE sync_history SET status = ?, completed_at = ?, events_added = ?, events_updated = ?, events_deleted = ?, events_skipped = ? WHERE id = ?'
    ).run('success', completedAt, stats.added, stats.updated, stats.deleted, stats.skipped, historyId);

    db.prepare('UPDATE sync_rules SET last_sync_at = ? WHERE id = ?').run(completedAt, syncRule.id);

    return {
      id: historyId,
      ruleId: syncRule.id,
      ruleName: syncRule.name,
      startedAt,
      completedAt,
      status: 'success',
      eventsAdded: stats.added,
      eventsUpdated: stats.updated,
      eventsDeleted: stats.deleted,
      eventsSkipped: stats.skipped,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const completedAt = Date.now();
    db.prepare(
      'UPDATE sync_history SET status = ?, completed_at = ?, events_added = ?, events_updated = ?, events_deleted = ?, events_skipped = ?, error_message = ? WHERE id = ?'
    ).run('failed', completedAt, stats.added, stats.updated, stats.deleted, stats.skipped, errorMessage, historyId);

    return {
      id: historyId,
      ruleId: syncRule.id,
      ruleName: syncRule.name,
      startedAt,
      completedAt,
      status: 'failed',
      eventsAdded: stats.added,
      eventsUpdated: stats.updated,
      eventsDeleted: stats.deleted,
      eventsSkipped: stats.skipped,
      errorMessage,
    };
  }
}

export async function syncAll(): Promise<SyncHistory[]> {
  const rules = db.prepare('SELECT id FROM sync_rules WHERE enabled = 1').all() as { id: string }[];
  const results: SyncHistory[] = [];
  for (const { id } of rules) {
    results.push(await performSync(id));
  }
  return results;
}
