import axios from 'axios';
import { Calendar, UnifiedEvent, CreateEventPayload } from '../types.js';
import { encrypt, decrypt } from './encryption.js';
import db from '../db.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    response_mode: 'query',
    scope: 'https://graph.microsoft.com/Calendars.ReadWrite https://graph.microsoft.com/User.Read offline_access',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiry: number;
  email: string;
  displayName: string;
}> {
  const { data: tokens } = await axios.post(TOKEN_ENDPOINT, new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    grant_type: 'authorization_code',
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const { data: user } = await axios.get(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiry: Date.now() + tokens.expires_in * 1000,
    email: user.mail || user.userPrincipalName,
    displayName: user.displayName || user.mail,
  };
}

async function getAccessToken(connectionId: string): Promise<string> {
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId) as Record<string, unknown>;
  if (!row) throw new Error('Connection not found');

  const tokenExpiry = row.token_expiry as number;
  const isExpired = !tokenExpiry || Date.now() > tokenExpiry - 60_000;

  if (!isExpired && row.access_token) {
    return decrypt(row.access_token as string);
  }

  // Refresh the token
  const refreshToken = row.refresh_token ? decrypt(row.refresh_token as string) : '';
  const { data: tokens } = await axios.post(TOKEN_ENDPOINT, new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const newExpiry = Date.now() + tokens.expires_in * 1000;
  db.prepare('UPDATE connections SET access_token = ?, refresh_token = ?, token_expiry = ?, updated_at = ? WHERE id = ?')
    .run(encrypt(tokens.access_token), encrypt(tokens.refresh_token), newExpiry, Date.now(), connectionId);

  return tokens.access_token;
}

async function graphGet<T>(connectionId: string, url: string): Promise<T> {
  const token = await getAccessToken(connectionId);
  const { data } = await axios.get(url.startsWith('http') ? url : `${GRAPH_BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

async function graphPost<T>(connectionId: string, url: string, body: unknown): Promise<T> {
  const token = await getAccessToken(connectionId);
  const { data } = await axios.post(`${GRAPH_BASE}${url}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data;
}

async function graphPatch<T>(connectionId: string, url: string, body: unknown): Promise<T> {
  const token = await getAccessToken(connectionId);
  const { data } = await axios.patch(`${GRAPH_BASE}${url}`, body, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return data;
}

async function graphDelete(connectionId: string, url: string): Promise<void> {
  const token = await getAccessToken(connectionId);
  await axios.delete(`${GRAPH_BASE}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listCalendars(connectionId: string): Promise<Calendar[]> {
  const data = await graphGet<{ value: Record<string, unknown>[] }>(connectionId, '/me/calendars');
  return data.value.map((item) => ({
    id: '',
    connectionId,
    externalId: item.id as string,
    name: item.name as string,
    color: item.color as string || undefined,
    readOnly: !(item.canEdit as boolean),
    provider: 'microsoft' as const,
  }));
}

export async function listEvents(
  connectionId: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<UnifiedEvent[]> {
  const filter = `start/dateTime ge '${timeMin.toISOString()}' and end/dateTime le '${timeMax.toISOString()}'`;
  const url = `/me/calendars/${calendarId}/events?$filter=${encodeURIComponent(filter)}&$top=250&$select=id,subject,bodyPreview,location,start,end,isAllDay,recurrence,attendees,organizer`;

  const events: UnifiedEvent[] = [];
  let nextUrl: string | undefined = url;

  while (nextUrl) {
    const data = await graphGet<{ value: Record<string, unknown>[]; '@odata.nextLink'?: string }>(connectionId, nextUrl);
    for (const item of data.value) {
      events.push(msEventToUnified(item, calendarId));
    }
    nextUrl = data['@odata.nextLink'];
  }

  return events;
}

function msEventToUnified(item: Record<string, unknown>, calendarId: string): UnifiedEvent {
  const start = item.start as { dateTime?: string; date?: string; timeZone?: string };
  const end = item.end as { dateTime?: string; date?: string };
  const location = item.location as { displayName?: string } | undefined;
  const recurrence = item.recurrence as { pattern?: unknown; range?: unknown } | null;
  const attendees = item.attendees as Array<{ emailAddress: { address: string } }> | undefined;
  const organizer = item.organizer as { emailAddress: { address: string } } | undefined;

  return {
    id: item.id as string,
    calendarId,
    provider: 'microsoft',
    title: (item.subject as string) || '(No title)',
    description: (item.bodyPreview as string) || undefined,
    location: location?.displayName || undefined,
    startTime: start.dateTime || start.date || '',
    endTime: end.dateTime || end.date || '',
    isAllDay: item.isAllDay as boolean,
    recurrenceRules: recurrence ? [`RRULE:FREQ=${(recurrence.pattern as Record<string,unknown>)?.type}`] : undefined,
    attendees: attendees?.map((a) => a.emailAddress.address) || undefined,
    organizer: organizer?.emailAddress.address || undefined,
  };
}

function payloadToMsEvent(payload: CreateEventPayload): Record<string, unknown> {
  const event: Record<string, unknown> = {
    subject: payload.title,
    body: { contentType: 'text', content: payload.description || '' },
    location: payload.location ? { displayName: payload.location } : undefined,
    isAllDay: payload.isAllDay,
  };

  if (payload.isAllDay) {
    const startDate = payload.startTime.split('T')[0];
    const endDate = payload.endTime.split('T')[0];
    event.start = { date: startDate };
    event.end = { date: endDate };
  } else {
    event.start = { dateTime: payload.startTime, timeZone: 'UTC' };
    event.end = { dateTime: payload.endTime, timeZone: 'UTC' };
  }

  return event;
}

export async function createEvent(
  connectionId: string,
  calendarId: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  const data = await graphPost<Record<string, unknown>>(connectionId, `/me/calendars/${calendarId}/events`, payloadToMsEvent(payload));
  return msEventToUnified(data, calendarId);
}

export async function updateEvent(
  connectionId: string,
  calendarId: string,
  eventId: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  const data = await graphPatch<Record<string, unknown>>(connectionId, `/me/events/${eventId}`, payloadToMsEvent(payload));
  return msEventToUnified(data, calendarId);
}

export async function deleteEvent(
  connectionId: string,
  _calendarId: string,
  eventId: string
): Promise<void> {
  await graphDelete(connectionId, `/me/events/${eventId}`);
}
