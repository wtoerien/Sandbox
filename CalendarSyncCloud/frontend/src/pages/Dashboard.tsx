import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getStats, triggerAllSync } from '../api/client';
import type { Stats, SyncHistory } from '../types';

function formatDate(ts?: number) {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

function StatusBadge({ status }: { status: SyncHistory['status'] }) {
  const map = { success: 'badge-success', failed: 'badge-error', partial: 'badge-warning', running: 'badge-info' } as const;
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    try {
      setStats(await getStats());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const results = await triggerAllSync();
      const total = results.reduce((acc, r) => acc + r.eventsAdded + r.eventsUpdated, 0);
      setSyncMsg(`Synced ${results.length} rules, ${total} events changed.`);
      await load();
    } catch {
      setSyncMsg('Sync failed. Check connections.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Overview of your calendar sync status</div>
        </div>
        <button className="btn-primary" onClick={handleSyncAll} disabled={syncing}>
          {syncing ? <><span className="spinner" style={{ width: '0.9rem', height: '0.9rem', borderWidth: 2 }} /> Syncing…</> : '⟳ Sync All'}
        </button>
      </div>

      {syncMsg && (
        <div className={`alert ${syncMsg.includes('failed') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: '1.5rem' }}>
          {syncMsg}
        </div>
      )}

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalConnections ?? 0}</div>
          <div className="stat-label">Connected Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.enabledRules ?? 0}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/{stats?.totalRules ?? 0}</span></div>
          <div className="stat-label">Active Sync Rules</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1rem', paddingTop: '0.4rem' }}>{formatDate(stats?.lastSyncAt)}</div>
          <div className="stat-label">Last Sync</div>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="section-title">Recent Activity</div>
        <Link to="/history" style={{ fontSize: '0.8rem' }}>View all →</Link>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {!stats?.recentHistory?.length ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <div>No sync history yet.</div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              <Link to="/connections">Connect a calendar</Link> to get started.
            </div>
          </div>
        ) : (
          stats.recentHistory.map((h) => (
            <div className="list-item" key={h.id}>
              <StatusBadge status={h.status} />
              <div className="list-item-content">
                <div className="list-item-title">{h.ruleName}</div>
                <div className="list-item-sub">
                  +{h.eventsAdded} added · {h.eventsUpdated} updated · {h.eventsDeleted} deleted
                  {h.errorMessage && <span style={{ color: 'var(--error)' }}> · {h.errorMessage}</span>}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                {h.startedAt ? new Date(h.startedAt).toLocaleTimeString() : ''}
              </div>
            </div>
          ))
        )}
      </div>

      {stats?.totalConnections === 0 && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'center', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Get started by connecting your calendar accounts.
          </div>
          <Link to="/connections"><button className="btn-primary">Connect Accounts</button></Link>
        </div>
      )}
    </div>
  );
}
