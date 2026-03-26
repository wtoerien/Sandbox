import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db.js';
import { encrypt } from '../services/encryption.js';
import * as googleService from '../services/google-service.js';
import * as microsoftService from '../services/microsoft-service.js';
import * as appleService from '../services/apple-service.js';

const router = Router();

// ── Google OAuth ────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  (req.session as Record<string, unknown>).oauthState = state;
  res.redirect(googleService.getAuthUrl(state));
});

router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code || state !== (req.session as Record<string, unknown>).oauthState) {
    return res.redirect(`${frontendUrl}?error=google_auth_failed`);
  }

  try {
    const tokens = await googleService.exchangeCode(code as string);

    // Check if a connection for this email already exists
    const existing = db.prepare("SELECT id FROM connections WHERE provider = 'google' AND email = ?").get(tokens.email) as { id: string } | undefined;

    const now = Date.now();
    if (existing) {
      db.prepare(
        'UPDATE connections SET access_token = ?, refresh_token = ?, token_expiry = ?, display_name = ?, updated_at = ? WHERE id = ?'
      ).run(encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiry, tokens.displayName, now, existing.id);
    } else {
      db.prepare(
        'INSERT INTO connections (id, provider, email, display_name, access_token, refresh_token, token_expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'google', tokens.email, tokens.displayName, encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiry, now, now);
    }

    res.redirect(`${frontendUrl}?connected=google`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${frontendUrl}?error=google_auth_failed`);
  }
});

// ── Microsoft OAuth ─────────────────────────────────────────────────────────

router.get('/microsoft', (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  (req.session as Record<string, unknown>).oauthState = state;
  res.redirect(microsoftService.getAuthUrl(state));
});

router.get('/microsoft/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error || !code || state !== (req.session as Record<string, unknown>).oauthState) {
    return res.redirect(`${frontendUrl}?error=microsoft_auth_failed`);
  }

  try {
    const tokens = await microsoftService.exchangeCode(code as string);

    const existing = db.prepare("SELECT id FROM connections WHERE provider = 'microsoft' AND email = ?").get(tokens.email) as { id: string } | undefined;

    const now = Date.now();
    if (existing) {
      db.prepare(
        'UPDATE connections SET access_token = ?, refresh_token = ?, token_expiry = ?, display_name = ?, updated_at = ? WHERE id = ?'
      ).run(encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiry, tokens.displayName, now, existing.id);
    } else {
      db.prepare(
        'INSERT INTO connections (id, provider, email, display_name, access_token, refresh_token, token_expiry, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), 'microsoft', tokens.email, tokens.displayName, encrypt(tokens.accessToken), encrypt(tokens.refreshToken), tokens.expiry, now, now);
    }

    res.redirect(`${frontendUrl}?connected=microsoft`);
  } catch (err) {
    console.error('Microsoft OAuth error:', err);
    res.redirect(`${frontendUrl}?error=microsoft_auth_failed`);
  }
});

// ── Apple CalDAV ────────────────────────────────────────────────────────────

router.post('/apple', async (req: Request, res: Response) => {
  const { username, password, serverUrl } = req.body as { username: string; password: string; serverUrl?: string };

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    await appleService.testConnection(username, password, serverUrl);

    const existing = db.prepare("SELECT id FROM connections WHERE provider = 'apple' AND email = ?").get(username) as { id: string } | undefined;
    const now = Date.now();

    if (existing) {
      db.prepare(
        'UPDATE connections SET caldav_password = ?, caldav_server_url = ?, display_name = ?, updated_at = ? WHERE id = ?'
      ).run(encrypt(password), serverUrl || null, username, now, existing.id);
      return res.json({ success: true, id: existing.id });
    }

    const id = uuidv4();
    db.prepare(
      'INSERT INTO connections (id, provider, email, display_name, caldav_username, caldav_password, caldav_server_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, 'apple', username, username, username, encrypt(password), serverUrl || null, now, now);

    res.json({ success: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed';
    res.status(400).json({ error: `Apple CalDAV connection failed: ${message}` });
  }
});

// ── Status and disconnect ───────────────────────────────────────────────────

router.get('/status', (_req: Request, res: Response) => {
  const connections = db.prepare(
    'SELECT id, provider, email, display_name, created_at, updated_at FROM connections ORDER BY created_at ASC'
  ).all() as Array<{ id: string; provider: string; email: string; display_name: string; created_at: number; updated_at: number }>;

  res.json(connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    email: c.email,
    displayName: c.display_name,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  })));
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const conn = db.prepare('SELECT id FROM connections WHERE id = ?').get(id);
  if (!conn) return res.status(404).json({ error: 'Connection not found' });

  db.prepare('DELETE FROM connections WHERE id = ?').run(id);
  res.json({ success: true });
});

export default router;
