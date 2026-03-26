import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { performSync, syncAll } from '../services/sync-engine.js';

const router = Router();

// ── Sync Rules ──────────────────────────────────────────────────────────────

router.get('/rules', (_req: Request, res: Response) => {
  const rules = db.prepare(`
    SELECT r.*,
      sc.name as source_calendar_name, sc.provider as source_provider,
      sc.color as source_color, sc.external_id as source_external_id,
      dc.name as dest_calendar_name, dc.provider as dest_provider,
      dc.color as dest_color, dc.external_id as dest_external_id,
      sc_conn.email as source_email, dc_conn.email as dest_email
    FROM sync_rules r
    LEFT JOIN calendars sc ON r.source_calendar_id = sc.id
    LEFT JOIN calendars dc ON r.destination_calendar_id = dc.id
    LEFT JOIN connections sc_conn ON sc.connection_id = sc_conn.id
    LEFT JOIN connections dc_conn ON dc.connection_id = dc_conn.id
    ORDER BY r.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  res.json(rules.map(mapRule));
});

router.post('/rules', (req: Request, res: Response) => {
  const {
    name, sourceCalendarId, destinationCalendarId,
    direction = 'one_way', enabled = true,
    syncDaysBack = 30, syncDaysForward = 365,
    duplicateHandling = 'skip', deletionHandling = 'ignore',
  } = req.body as Record<string, unknown>;

  if (!name || !sourceCalendarId || !destinationCalendarId) {
    return res.status(400).json({ error: 'name, sourceCalendarId, destinationCalendarId are required' });
  }

  if (sourceCalendarId === destinationCalendarId) {
    return res.status(400).json({ error: 'Source and destination calendars must be different' });
  }

  const id = uuidv4();
  db.prepare(`
    INSERT INTO sync_rules (id, name, source_calendar_id, destination_calendar_id, direction, enabled, sync_days_back, sync_days_forward, duplicate_handling, deletion_handling, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, sourceCalendarId, destinationCalendarId, direction, enabled ? 1 : 0, syncDaysBack, syncDaysForward, duplicateHandling, deletionHandling, Date.now());

  const rule = db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(mapRuleSimple(rule));
});

router.put('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = db.prepare('SELECT id FROM sync_rules WHERE id = ?').get(id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const {
    name, direction, enabled,
    syncDaysBack, syncDaysForward,
    duplicateHandling, deletionHandling,
  } = req.body as Record<string, unknown>;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (direction !== undefined) { fields.push('direction = ?'); values.push(direction); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }
  if (syncDaysBack !== undefined) { fields.push('sync_days_back = ?'); values.push(syncDaysBack); }
  if (syncDaysForward !== undefined) { fields.push('sync_days_forward = ?'); values.push(syncDaysForward); }
  if (duplicateHandling !== undefined) { fields.push('duplicate_handling = ?'); values.push(duplicateHandling); }
  if (deletionHandling !== undefined) { fields.push('deletion_handling = ?'); values.push(deletionHandling); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);
  db.prepare(`UPDATE sync_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM sync_rules WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(mapRuleSimple(updated));
});

router.delete('/rules/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = db.prepare('SELECT id FROM sync_rules WHERE id = ?').get(id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  db.prepare('DELETE FROM sync_rules WHERE id = ?').run(id);
  res.json({ success: true });
});

// ── Sync Trigger ────────────────────────────────────────────────────────────

router.post('/rules/:id/trigger', async (req: Request, res: Response) => {
  const { id } = req.params;
  const rule = db.prepare('SELECT id FROM sync_rules WHERE id = ?').get(id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  try {
    const result = await performSync(id);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

router.post('/trigger-all', async (_req: Request, res: Response) => {
  try {
    const results = await syncAll();
    res.json(results);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ── Sync History ────────────────────────────────────────────────────────────

router.get('/history', (req: Request, res: Response) => {
  const { ruleId, limit = '50' } = req.query as { ruleId?: string; limit?: string };
  const limitNum = Math.min(parseInt(limit, 10), 200);

  const where = ruleId ? 'WHERE rule_id = ?' : '';
  const args: unknown[] = ruleId ? [ruleId, limitNum] : [limitNum];

  const history = db.prepare(
    `SELECT * FROM sync_history ${where} ORDER BY started_at DESC LIMIT ?`
  ).all(...args) as Array<Record<string, unknown>>;

  res.json(history.map(mapHistory));
});

router.delete('/history', (_req: Request, res: Response) => {
  db.prepare('DELETE FROM sync_history').run();
  res.json({ success: true });
});

// ── Stats ───────────────────────────────────────────────────────────────────

router.get('/stats', (_req: Request, res: Response) => {
  const totalRules = (db.prepare('SELECT COUNT(*) as n FROM sync_rules').get() as { n: number }).n;
  const enabledRules = (db.prepare('SELECT COUNT(*) as n FROM sync_rules WHERE enabled = 1').get() as { n: number }).n;
  const totalConnections = (db.prepare('SELECT COUNT(*) as n FROM connections').get() as { n: number }).n;
  const lastSync = db.prepare('SELECT MAX(completed_at) as t FROM sync_history WHERE status = ?').get('success') as { t: number | null };

  const recentHistory = db.prepare(
    'SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 5'
  ).all() as Array<Record<string, unknown>>;

  res.json({
    totalRules,
    enabledRules,
    totalConnections,
    lastSyncAt: lastSync.t,
    recentHistory: recentHistory.map(mapHistory),
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapRuleSimple(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    sourceCalendarId: r.source_calendar_id,
    destinationCalendarId: r.destination_calendar_id,
    direction: r.direction,
    enabled: !!(r.enabled),
    syncDaysBack: r.sync_days_back,
    syncDaysForward: r.sync_days_forward,
    duplicateHandling: r.duplicate_handling,
    deletionHandling: r.deletion_handling,
    lastSyncAt: r.last_sync_at,
    createdAt: r.created_at,
  };
}

function mapRule(r: Record<string, unknown>) {
  return {
    ...mapRuleSimple(r),
    sourceCalendar: {
      name: r.source_calendar_name,
      provider: r.source_provider,
      color: r.source_color,
      externalId: r.source_external_id,
      accountEmail: r.source_email,
    },
    destinationCalendar: {
      name: r.dest_calendar_name,
      provider: r.dest_provider,
      color: r.dest_color,
      externalId: r.dest_external_id,
      accountEmail: r.dest_email,
    },
  };
}

function mapHistory(h: Record<string, unknown>) {
  return {
    id: h.id,
    ruleId: h.rule_id,
    ruleName: h.rule_name,
    startedAt: h.started_at,
    completedAt: h.completed_at,
    status: h.status,
    eventsAdded: h.events_added,
    eventsUpdated: h.events_updated,
    eventsDeleted: h.events_deleted,
    eventsSkipped: h.events_skipped,
    errorMessage: h.error_message,
  };
}

export default router;
