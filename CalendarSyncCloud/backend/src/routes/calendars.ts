import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import { Provider } from '../types.js';
import * as googleService from '../services/google-service.js';
import * as microsoftService from '../services/microsoft-service.js';
import * as appleService from '../services/apple-service.js';

const router = Router();

// Fetch and refresh calendars for all connections (or a specific one)
router.post('/refresh', async (req: Request, res: Response) => {
  const { connectionId } = req.body as { connectionId?: string };

  const where = connectionId ? 'WHERE id = ?' : '';
  const args = connectionId ? [connectionId] : [];
  const connections = db.prepare(`SELECT * FROM connections ${where}`).all(...args) as Array<Record<string, unknown>>;

  const results: Array<{ connectionId: string; count: number; error?: string }> = [];

  for (const conn of connections) {
    try {
      let calendars;
      switch (conn.provider as Provider) {
        case 'google':    calendars = await googleService.listCalendars(conn.id as string); break;
        case 'microsoft': calendars = await microsoftService.listCalendars(conn.id as string); break;
        case 'apple':     calendars = await appleService.listCalendars(conn.id as string); break;
      }

      const upsert = db.prepare(`
        INSERT INTO calendars (id, connection_id, external_id, name, description, color, timezone, read_only, provider)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(connection_id, external_id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          color = excluded.color,
          timezone = excluded.timezone,
          read_only = excluded.read_only
      `);

      const upsertMany = db.transaction((cals) => {
        for (const cal of cals) {
          upsert.run(
            uuidv4(), cal.connectionId, cal.externalId, cal.name,
            cal.description || null, cal.color || null, cal.timezone || null,
            cal.readOnly ? 1 : 0, cal.provider
          );
        }
      });
      upsertMany(calendars!);

      results.push({ connectionId: conn.id as string, count: calendars!.length });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ connectionId: conn.id as string, count: 0, error });
    }
  }

  res.json(results);
});

// List all calendars
router.get('/', (_req: Request, res: Response) => {
  const calendars = db.prepare(`
    SELECT c.*, conn.email, conn.display_name, conn.provider as conn_provider
    FROM calendars c
    JOIN connections conn ON c.connection_id = conn.id
    ORDER BY conn.email, c.name
  `).all() as Array<Record<string, unknown>>;

  res.json(calendars.map((c) => ({
    id: c.id,
    connectionId: c.connection_id,
    externalId: c.external_id,
    name: c.name,
    description: c.description,
    color: c.color,
    timezone: c.timezone,
    readOnly: !!(c.read_only),
    provider: c.provider,
    accountEmail: c.email,
    accountName: c.display_name,
  })));
});

// Get calendars for a specific connection
router.get('/connection/:connectionId', (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const calendars = db.prepare('SELECT * FROM calendars WHERE connection_id = ? ORDER BY name').all(connectionId) as Array<Record<string, unknown>>;

  res.json(calendars.map((c) => ({
    id: c.id,
    connectionId: c.connection_id,
    externalId: c.external_id,
    name: c.name,
    description: c.description,
    color: c.color,
    timezone: c.timezone,
    readOnly: !!(c.read_only),
    provider: c.provider,
  })));
});

export default router;
