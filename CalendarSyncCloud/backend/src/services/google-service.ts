import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Calendar, UnifiedEvent, CreateEventPayload } from '../types.js';
import { decrypt } from './encryption.js';
import db from '../db.js';

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/userinfo.email'],
    state,
  });
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiry: number;
  email: string;
  displayName: string;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    expiry: tokens.expiry_date!,
    email: data.email!,
    displayName: data.name || data.email!,
  };
}

async function getAuthenticatedClient(connectionId: string): Promise<OAuth2Client> {
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId) as Record<string, unknown>;
  if (!row) throw new Error('Connection not found');

  const oauth2Client = createOAuth2Client();
  const accessToken = row.access_token ? decrypt(row.access_token as string) : '';
  const refreshToken = row.refresh_token ? decrypt(row.refresh_token as string) : '';

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: row.token_expiry as number,
  });

  // Auto-refresh if expired
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token) {
      const { encrypt } = require('./encryption.js');
      db.prepare('UPDATE connections SET access_token = ?, token_expiry = ?, updated_at = ? WHERE id = ?')
        .run(encrypt(tokens.access_token), tokens.expiry_date, Date.now(), connectionId);
    }
  });

  return oauth2Client;
}

export async function listCalendars(connectionId: string): Promise<Calendar[]> {
  const auth = await getAuthenticatedClient(connectionId);
  const calApi = google.calendar({ version: 'v3', auth });
  const { data } = await calApi.calendarList.list({ minAccessRole: 'writer' });

  return (data.items || []).map((item) => ({
    id: '',
    connectionId,
    externalId: item.id!,
    name: item.summary!,
    description: item.description || undefined,
    color: item.backgroundColor || item.colorId || undefined,
    timezone: item.timeZone || undefined,
    readOnly: item.accessRole === 'reader',
    provider: 'google' as const,
  }));
}

export async function listEvents(
  connectionId: string,
  calendarId: string, // externalId of the calendar
  timeMin: Date,
  timeMax: Date
): Promise<UnifiedEvent[]> {
  const auth = await getAuthenticatedClient(connectionId);
  const calApi = google.calendar({ version: 'v3', auth });

  const events: UnifiedEvent[] = [];
  let pageToken: string | undefined;

  do {
    const { data } = await calApi.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: false,
      maxResults: 250,
      pageToken,
    });

    for (const item of data.items || []) {
      if (!item.id || item.status === 'cancelled') continue;
      events.push(googleEventToUnified(item, calendarId, connectionId));
    }
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return events;
}

function googleEventToUnified(item: calendar_v3.Schema$Event, calendarExternalId: string, connectionId: string): UnifiedEvent {
  const isAllDay = !!(item.start?.date && !item.start?.dateTime);
  return {
    id: item.id!,
    calendarId: calendarExternalId,
    provider: 'google',
    title: item.summary || '(No title)',
    description: item.description || undefined,
    location: item.location || undefined,
    startTime: item.start?.dateTime || item.start?.date || '',
    endTime: item.end?.dateTime || item.end?.date || '',
    isAllDay,
    recurrenceRules: item.recurrence || undefined,
    attendees: item.attendees?.map((a) => a.email!).filter(Boolean) || undefined,
    organizer: item.organizer?.email || undefined,
    etag: item.etag || undefined,
  };
}

export async function createEvent(
  connectionId: string,
  calendarId: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  const auth = await getAuthenticatedClient(connectionId);
  const calApi = google.calendar({ version: 'v3', auth });

  const requestBody: calendar_v3.Schema$Event = {
    summary: payload.title,
    description: payload.description,
    location: payload.location,
    recurrence: payload.recurrenceRules,
  };

  if (payload.isAllDay) {
    requestBody.start = { date: payload.startTime.split('T')[0] };
    requestBody.end = { date: payload.endTime.split('T')[0] };
  } else {
    requestBody.start = { dateTime: payload.startTime };
    requestBody.end = { dateTime: payload.endTime };
  }

  const { data } = await calApi.events.insert({ calendarId, requestBody });
  return googleEventToUnified(data, calendarId, connectionId);
}

export async function updateEvent(
  connectionId: string,
  calendarId: string,
  eventId: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  const auth = await getAuthenticatedClient(connectionId);
  const calApi = google.calendar({ version: 'v3', auth });

  const requestBody: calendar_v3.Schema$Event = {
    summary: payload.title,
    description: payload.description,
    location: payload.location,
    recurrence: payload.recurrenceRules,
  };

  if (payload.isAllDay) {
    requestBody.start = { date: payload.startTime.split('T')[0] };
    requestBody.end = { date: payload.endTime.split('T')[0] };
  } else {
    requestBody.start = { dateTime: payload.startTime };
    requestBody.end = { dateTime: payload.endTime };
  }

  const { data } = await calApi.events.update({ calendarId, eventId, requestBody });
  return googleEventToUnified(data, calendarId, connectionId);
}

export async function deleteEvent(
  connectionId: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const auth = await getAuthenticatedClient(connectionId);
  const calApi = google.calendar({ version: 'v3', auth });
  await calApi.events.delete({ calendarId, eventId });
}
