import axios from 'axios';
import type { Connection, Calendar, SyncRule, SyncHistory, Stats } from '../types';

const api = axios.create({ baseURL: '/', withCredentials: true });

// ── Auth / Connections ───────────────────────────────────────────────────────

export const getConnections = () =>
  api.get<Connection[]>('/auth/status').then((r) => r.data);

export const connectGoogle = () => {
  window.location.href = '/auth/google';
};

export const connectMicrosoft = () => {
  window.location.href = '/auth/microsoft';
};

export const connectApple = (username: string, password: string, serverUrl?: string) =>
  api.post('/auth/apple', { username, password, serverUrl }).then((r) => r.data);

export const disconnectProvider = (id: string) =>
  api.delete(`/auth/${id}`).then((r) => r.data);

// ── Calendars ────────────────────────────────────────────────────────────────

export const getCalendars = () =>
  api.get<Calendar[]>('/calendars').then((r) => r.data);

export const refreshCalendars = (connectionId?: string) =>
  api.post('/calendars/refresh', connectionId ? { connectionId } : {}).then((r) => r.data);

// ── Sync Rules ───────────────────────────────────────────────────────────────

export const getSyncRules = () =>
  api.get<SyncRule[]>('/sync/rules').then((r) => r.data);

export const createSyncRule = (data: Partial<SyncRule>) =>
  api.post<SyncRule>('/sync/rules', data).then((r) => r.data);

export const updateSyncRule = (id: string, data: Partial<SyncRule>) =>
  api.put<SyncRule>(`/sync/rules/${id}`, data).then((r) => r.data);

export const deleteSyncRule = (id: string) =>
  api.delete(`/sync/rules/${id}`).then((r) => r.data);

export const triggerSync = (ruleId: string) =>
  api.post<SyncHistory>(`/sync/rules/${ruleId}/trigger`).then((r) => r.data);

export const triggerAllSync = () =>
  api.post<SyncHistory[]>('/sync/trigger-all').then((r) => r.data);

// ── History ──────────────────────────────────────────────────────────────────

export const getSyncHistory = (ruleId?: string, limit = 50) =>
  api.get<SyncHistory[]>('/sync/history', { params: { ruleId, limit } }).then((r) => r.data);

export const clearHistory = () =>
  api.delete('/sync/history').then((r) => r.data);

// ── Stats ────────────────────────────────────────────────────────────────────

export const getStats = () =>
  api.get<Stats>('/sync/stats').then((r) => r.data);
