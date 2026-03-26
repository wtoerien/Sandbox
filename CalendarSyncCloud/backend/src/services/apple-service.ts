import { DAVClient, DAVCalendar, DAVObject } from 'tsdav';
import { Calendar, UnifiedEvent, CreateEventPayload } from '../types.js';
import { decrypt } from './encryption.js';
import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CALDAV_SERVER = 'https://caldav.icloud.com';

function icsDate(iso: string, isAllDay: boolean): string {
  if (isAllDay) {
    return iso.split('T')[0].replace(/-/g, '');
  }
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function parseIcsDate(value: string): { iso: string; isAllDay: boolean } {
  if (value.length === 8) {
    // DATE format: YYYYMMDD
    return { iso: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, isAllDay: true };
  }
  // DATETIME format: YYYYMMDDTHHMMSSZ
  const clean = value.replace('Z', '').replace('T', 'T');
  const year = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day = clean.slice(6, 8);
  const hour = clean.slice(9, 11);
  const min = clean.slice(11, 13);
  const sec = clean.slice(13, 15);
  return { iso: `${year}-${month}-${day}T${hour}:${min}:${sec}Z`, isAllDay: false };
}

function parseIcsProperty(ics: string, prop: string): string | undefined {
  const lines = ics.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith(`${prop}:`) || line.startsWith(`${prop};`)) {
      const colonIdx = line.indexOf(':');
      return line.slice(colonIdx + 1).trim();
    }
  }
  return undefined;
}

function parseAllIcsProperties(ics: string, prop: string): string[] {
  return ics.split(/\r?\n/)
    .filter((l) => l.startsWith(`${prop}:`) || l.startsWith(`${prop};`))
    .map((l) => l.slice(l.indexOf(':') + 1).trim());
}

function icsToUnifiedEvent(obj: DAVObject, calendarId: string): UnifiedEvent | null {
  const ics = obj.data as string;
  if (!ics) return null;

  const uid = parseIcsProperty(ics, 'UID');
  const summary = parseIcsProperty(ics, 'SUMMARY');
  const description = parseIcsProperty(ics, 'DESCRIPTION');
  const location = parseIcsProperty(ics, 'LOCATION');
  const dtstart = parseIcsProperty(ics, 'DTSTART');
  const dtend = parseIcsProperty(ics, 'DTEND') || parseIcsProperty(ics, 'DUE');
  const rrules = parseAllIcsProperties(ics, 'RRULE');
  const organizer = parseIcsProperty(ics, 'ORGANIZER');

  if (!uid || !dtstart) return null;

  const start = parseIcsDate(dtstart.includes(':') ? dtstart.split(':').pop()! : dtstart);
  const end = dtend ? parseIcsDate(dtend.includes(':') ? dtend.split(':').pop()! : dtend) : start;

  return {
    id: uid,
    calendarId,
    provider: 'apple',
    title: summary || '(No title)',
    description: description?.replace(/\\n/g, '\n') || undefined,
    location: location || undefined,
    startTime: start.iso,
    endTime: end.iso,
    isAllDay: start.isAllDay,
    recurrenceRules: rrules.length > 0 ? rrules : undefined,
    organizer: organizer?.replace('mailto:', '') || undefined,
    etag: obj.etag || undefined,
    url: obj.url,
  };
}

function buildIcs(uid: string, payload: CreateEventPayload): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace('.000', '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalendarSync//CalendarSync//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `SUMMARY:${payload.title}`,
  ];

  if (payload.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${icsDate(payload.startTime, true)}`);
    lines.push(`DTEND;VALUE=DATE:${icsDate(payload.endTime, true)}`);
  } else {
    lines.push(`DTSTART:${icsDate(payload.startTime, false)}`);
    lines.push(`DTEND:${icsDate(payload.endTime, false)}`);
  }

  if (payload.description) lines.push(`DESCRIPTION:${payload.description.replace(/\n/g, '\\n')}`);
  if (payload.location) lines.push(`LOCATION:${payload.location}`);
  if (payload.recurrenceRules) payload.recurrenceRules.forEach((r) => lines.push(r.startsWith('RRULE:') ? r : `RRULE:${r}`));

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

async function getClient(connectionId: string): Promise<{ client: DAVClient; row: Record<string, unknown> }> {
  const row = db.prepare('SELECT * FROM connections WHERE id = ?').get(connectionId) as Record<string, unknown>;
  if (!row) throw new Error('Connection not found');

  const username = row.caldav_username as string;
  const password = row.caldav_password ? decrypt(row.caldav_password as string) : '';
  const serverUrl = (row.caldav_server_url as string) || DEFAULT_CALDAV_SERVER;

  const client = new DAVClient({
    serverUrl,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });

  await client.login();
  return { client, row };
}

export async function testConnection(username: string, password: string, serverUrl?: string): Promise<string> {
  const client = new DAVClient({
    serverUrl: serverUrl || DEFAULT_CALDAV_SERVER,
    credentials: { username, password },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  await client.login();
  // Try fetching calendars to verify
  await client.fetchCalendars();
  return username;
}

export async function listCalendars(connectionId: string): Promise<Calendar[]> {
  const { client } = await getClient(connectionId);
  const davCalendars: DAVCalendar[] = await client.fetchCalendars();

  return davCalendars
    .filter((cal) => cal.components?.includes('VEVENT'))
    .map((cal) => ({
      id: '',
      connectionId,
      externalId: cal.url,
      name: (cal.displayName as string) || cal.url.split('/').filter(Boolean).pop() || 'Calendar',
      color: (cal as Record<string, unknown>)['apple-calendar-color'] as string || undefined,
      readOnly: false,
      provider: 'apple' as const,
    }));
}

export async function listEvents(
  connectionId: string,
  calendarUrl: string,
  timeMin: Date,
  timeMax: Date
): Promise<UnifiedEvent[]> {
  const { client } = await getClient(connectionId);
  const objects: DAVObject[] = await client.fetchCalendarObjects({
    calendar: { url: calendarUrl } as DAVCalendar,
    timeRange: { start: timeMin.toISOString(), end: timeMax.toISOString() },
  });

  const events: UnifiedEvent[] = [];
  for (const obj of objects) {
    const event = icsToUnifiedEvent(obj, calendarUrl);
    if (event) events.push(event);
  }
  return events;
}

export async function createEvent(
  connectionId: string,
  calendarUrl: string,
  payload: CreateEventPayload
): Promise<UnifiedEvent> {
  const { client } = await getClient(connectionId);
  const uid = uuidv4();
  const icsData = buildIcs(uid, payload);

  const filename = `${uid}.ics`;
  await client.createCalendarObject({
    calendar: { url: calendarUrl } as DAVCalendar,
    filename,
    iCalString: icsData,
  });

  return {
    id: uid,
    calendarId: calendarUrl,
    provider: 'apple',
    title: payload.title,
    description: payload.description,
    location: payload.location,
    startTime: payload.startTime,
    endTime: payload.endTime,
    isAllDay: payload.isAllDay,
    recurrenceRules: payload.recurrenceRules,
    url: `${calendarUrl}${filename}`,
  };
}

export async function updateEvent(
  connectionId: string,
  _calendarUrl: string,
  eventUrl: string,
  payload: CreateEventPayload,
  uid: string
): Promise<UnifiedEvent> {
  const { client } = await getClient(connectionId);
  const icsData = buildIcs(uid, payload);

  await client.updateCalendarObject({
    calendarObject: { url: eventUrl, data: icsData, etag: '' },
  });

  return {
    id: uid,
    calendarId: _calendarUrl,
    provider: 'apple',
    title: payload.title,
    description: payload.description,
    location: payload.location,
    startTime: payload.startTime,
    endTime: payload.endTime,
    isAllDay: payload.isAllDay,
    recurrenceRules: payload.recurrenceRules,
    url: eventUrl,
  };
}

export async function deleteEvent(
  connectionId: string,
  _calendarUrl: string,
  eventUrl: string
): Promise<void> {
  const { client } = await getClient(connectionId);
  await client.deleteCalendarObject({
    calendarObject: { url: eventUrl, etag: '' },
  });
}
