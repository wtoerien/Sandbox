import { useEffect, useState, useCallback } from 'react';
import {
  getSyncRules, getCalendars, createSyncRule, updateSyncRule,
  deleteSyncRule, triggerSync,
} from '../api/client';
import type { SyncRule, Calendar, Provider } from '../types';

function ProviderDot({ provider }: { provider?: Provider }) {
  const colors = { google: '#ea4335', microsoft: '#00a4ef', apple: '#888' };
  return <div className="color-dot" style={{ background: provider ? colors[provider] : 'var(--border)' }} />;
}

function CalendarSelect({ value, onChange, calendars, exclude }: {
  value: string;
  onChange: (id: string) => void;
  calendars: Calendar[];
  exclude?: string;
}) {
  const filtered = calendars.filter((c) => c.id !== exclude);
  const grouped = filtered.reduce<Record<string, Calendar[]>>((acc, cal) => {
    const key = `${cal.provider}:${cal.accountEmail}`;
    (acc[key] = acc[key] || []).push(cal);
    return acc;
  }, {});

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select calendar…</option>
      {Object.entries(grouped).map(([key, cals]) => (
        <optgroup key={key} label={`${cals[0].provider.charAt(0).toUpperCase() + cals[0].provider.slice(1)} — ${cals[0].accountEmail}`}>
          {cals.map((cal) => (
            <option key={cal.id} value={cal.id}>{cal.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

interface RuleFormData {
  name: string;
  sourceCalendarId: string;
  destinationCalendarId: string;
  direction: 'one_way' | 'two_way';
  syncDaysBack: number;
  syncDaysForward: number;
  duplicateHandling: 'skip' | 'overwrite' | 'keep_both';
  deletionHandling: 'propagate' | 'ignore';
}

function RuleModal({
  rule, calendars, onClose, onSave,
}: {
  rule?: SyncRule;
  calendars: Calendar[];
  onClose: () => void;
  onSave: (data: RuleFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<RuleFormData>({
    name: rule?.name || '',
    sourceCalendarId: rule?.sourceCalendarId || '',
    destinationCalendarId: rule?.destinationCalendarId || '',
    direction: rule?.direction || 'one_way',
    syncDaysBack: rule?.syncDaysBack ?? 30,
    syncDaysForward: rule?.syncDaysForward ?? 365,
    duplicateHandling: rule?.duplicateHandling || 'skip',
    deletionHandling: rule?.deletionHandling || 'ignore',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof RuleFormData, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.sourceCalendarId) { setError('Source calendar is required.'); return; }
    if (!form.destinationCalendarId) { setError('Destination calendar is required.'); return; }
    if (form.sourceCalendarId === form.destinationCalendarId) { setError('Source and destination must differ.'); return; }
    setLoading(true);
    setError('');
    try { await onSave(form); onClose(); }
    catch { setError('Failed to save rule.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{rule ? 'Edit Sync Rule' : 'New Sync Rule'}</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <label>Rule Name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Work → Personal" />
            </div>
            <div className="form-row">
              <label>Source Calendar</label>
              <CalendarSelect value={form.sourceCalendarId} onChange={(v) => set('sourceCalendarId', v)} calendars={calendars} exclude={form.destinationCalendarId} />
            </div>
            <div className="form-row">
              <label>Destination Calendar</label>
              <CalendarSelect value={form.destinationCalendarId} onChange={(v) => set('destinationCalendarId', v)} calendars={calendars} exclude={form.sourceCalendarId} />
            </div>
            <div className="form-row">
              <label>Sync Direction</label>
              <select value={form.direction} onChange={(e) => set('direction', e.target.value)}>
                <option value="one_way">One-way (source → destination)</option>
                <option value="two_way">Two-way (bidirectional)</option>
              </select>
            </div>
            <div className="form-grid">
              <div className="form-row">
                <label>Days Back</label>
                <input type="number" min={0} max={3650} value={form.syncDaysBack} onChange={(e) => set('syncDaysBack', parseInt(e.target.value) || 0)} />
              </div>
              <div className="form-row">
                <label>Days Forward</label>
                <input type="number" min={0} max={3650} value={form.syncDaysForward} onChange={(e) => set('syncDaysForward', parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="form-row">
              <label>Duplicate Handling</label>
              <select value={form.duplicateHandling} onChange={(e) => set('duplicateHandling', e.target.value)}>
                <option value="skip">Skip — don't overwrite existing events</option>
                <option value="overwrite">Overwrite — update destination with source</option>
                <option value="keep_both">Keep Both — always create new copies</option>
              </select>
            </div>
            <div className="form-row">
              <label>Deletion Handling</label>
              <select value={form.deletionHandling} onChange={(e) => set('deletionHandling', e.target.value)}>
                <option value="ignore">Ignore — keep destination events if source deleted</option>
                <option value="propagate">Propagate — delete destination if source deleted</option>
              </select>
            </div>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving…' : (rule ? 'Update' : 'Create Rule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SyncRules() {
  const [rules, setRules] = useState<SyncRule[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState<SyncRule | undefined>();
  const [showModal, setShowModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [notification, setNotification] = useState('');

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([getSyncRules(), getCalendars()]);
    setRules(r);
    setCalendars(c);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: RuleFormData) => {
    if (editRule) await updateSyncRule(editRule.id, data);
    else await createSyncRule(data);
    await load();
  };

  const handleToggle = async (rule: SyncRule) => {
    await updateSyncRule(rule.id, { enabled: !rule.enabled });
    await load();
  };

  const handleDelete = async (rule: SyncRule) => {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    await deleteSyncRule(rule.id);
    await load();
  };

  const handleSync = async (rule: SyncRule) => {
    setSyncing(rule.id);
    setNotification('');
    try {
      const result = await triggerSync(rule.id);
      setNotification(`Sync complete: +${result.eventsAdded} added, ${result.eventsUpdated} updated`);
      await load();
    } catch {
      setNotification('Sync failed.');
    } finally {
      setSyncing(null);
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Sync Rules</div>
          <div className="page-subtitle">Configure how calendars are synchronized</div>
        </div>
        <button className="btn-primary" onClick={() => { setEditRule(undefined); setShowModal(true); }}>
          + New Rule
        </button>
      </div>

      {notification && (
        <div className={`alert ${notification.includes('failed') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1rem' }}>
          {notification}
        </div>
      )}

      {rules.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">↔</div>
          <div className="empty-state-title">No sync rules yet</div>
          <div className="empty-state-text">Create a rule to start syncing events between calendars.</div>
          <button className="btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowModal(true)}>
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {rules.map((rule) => (
            <div className="list-item" key={rule.id} style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
              <label className="toggle" style={{ marginTop: '0.1rem' }}>
                <input type="checkbox" checked={rule.enabled} onChange={() => handleToggle(rule)} />
                <span className="toggle-slider" />
              </label>
              <div className="list-item-content">
                <div className="list-item-title">{rule.name}</div>
                <div className="list-item-sub" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <ProviderDot provider={rule.sourceCalendar?.provider} />
                  <span>{rule.sourceCalendar?.name || 'Unknown'}</span>
                  <span className="arrow">{rule.direction === 'two_way' ? '⇄' : '→'}</span>
                  <ProviderDot provider={rule.destinationCalendar?.provider} />
                  <span>{rule.destinationCalendar?.name || 'Unknown'}</span>
                  <span>·</span>
                  <span>{rule.direction === 'two_way' ? 'Two-way' : 'One-way'}</span>
                  {rule.lastSyncAt && <span>· Last: {new Date(rule.lastSyncAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleSync(rule)}
                  disabled={syncing === rule.id}
                >
                  {syncing === rule.id ? '…' : '⟳ Sync'}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => { setEditRule(rule); setShowModal(true); }}>
                  Edit
                </button>
                <button className="btn-icon btn-sm" onClick={() => handleDelete(rule)} title="Delete">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editRule}
          calendars={calendars}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
