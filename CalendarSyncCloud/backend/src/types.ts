export type Provider = 'google' | 'microsoft' | 'apple';
export type SyncDirection = 'one_way' | 'two_way';
export type DuplicateHandling = 'skip' | 'overwrite' | 'keep_both';
export type DeletionHandling = 'propagate' | 'ignore';
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

export interface Connection {
  id: string;
  provider: Provider;
  email: string;
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  caldavUsername?: string;
  caldavPassword?: string;
  caldavServerUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Calendar {
  id: string;
  connectionId: string;
  externalId: string;
  name: string;
  description?: string;
  color?: string;
  timezone?: string;
  readOnly: boolean;
  provider: Provider;
}

export interface SyncRule {
  id: string;
  name: string;
  sourceCalendarId: string;
  destinationCalendarId: string;
  direction: SyncDirection;
  enabled: boolean;
  syncDaysBack: number;
  syncDaysForward: number;
  duplicateHandling: DuplicateHandling;
  deletionHandling: DeletionHandling;
  lastSyncAt?: number;
  createdAt: number;
}

export interface EventMapping {
  id: string;
  ruleId: string;
  sourceEventId: string;
  destinationEventId: string;
  sourceCalendarId: string;
  destinationCalendarId: string;
  sourceEtag?: string;
  destinationEtag?: string;
  lastSyncedAt: number;
}

export interface SyncHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  startedAt: number;
  completedAt?: number;
  status: SyncStatus;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
  errorMessage?: string;
}

export interface UnifiedEvent {
  id: string;
  calendarId: string;
  provider: Provider;
  title: string;
  description?: string;
  location?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  isAllDay: boolean;
  recurrenceRules?: string[];
  attendees?: string[];
  organizer?: string;
  etag?: string;
  url?: string; // CalDAV URL
}

export interface CreateEventPayload {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrenceRules?: string[];
}
