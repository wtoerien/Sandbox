export type Provider = 'google' | 'microsoft' | 'apple';
export type SyncDirection = 'one_way' | 'two_way';
export type DuplicateHandling = 'skip' | 'overwrite' | 'keep_both';
export type DeletionHandling = 'propagate' | 'ignore';
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed';

export interface Connection {
  id: string;
  provider: Provider;
  email: string;
  displayName: string;
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
  accountEmail?: string;
  accountName?: string;
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
  sourceCalendar?: {
    name: string;
    provider: Provider;
    color?: string;
    accountEmail?: string;
  };
  destinationCalendar?: {
    name: string;
    provider: Provider;
    color?: string;
    accountEmail?: string;
  };
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

export interface Stats {
  totalRules: number;
  enabledRules: number;
  totalConnections: number;
  lastSyncAt?: number;
  recentHistory: SyncHistory[];
}
