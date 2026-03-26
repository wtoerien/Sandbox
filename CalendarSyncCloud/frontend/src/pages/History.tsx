import { useEffect, useState, useCallback } from 'react';
import { getSyncHistory, clearHistory } from '../api/client';
import type { SyncHistory } from '../types';

function StatusBadge({ status }: { status: SyncHistory['status'] }) {
  const map = { success: 'badge-success', failed: 'badge-error', partial: 'badge-warning', running: 'badge-info' } as const;
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

function duration(start?: number, end?: number): string {
  if (!start || !end) return '';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function History() {
  const [history, setHistory] = useState<SyncHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setHistory(await getSyncHistory(undefined, 100)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClear = async () => {
    if (!confirm('Clear all sync history?')) return;
    await clearHistory();
    setHistory([]);
  };

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Sync History</div>
          <div className="page-subtitle">Log of all sync operations</div>
        </div>
        {history.length > 0 && (
          <button className="btn-danger btn-sm" onClick={handleClear}>Clear History</button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◷</div>
          <div className="empty-state-title">No sync history</div>
          <div className="empty-state-text">History will appear after your first sync runs.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {history.map((h) => (
            <div className="list-item" key={h.id} style={{ alignItems: 'flex-start' }}>
              <div style={{ paddingTop: '0.1rem' }}>
                <StatusBadge status={h.status} />
              </div>
              <div className="list-item-content">
                <div className="list-item-title">{h.ruleName}</div>
                <div className="list-item-sub" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--success)' }}>+{h.eventsAdded}</span>
                  <span style={{ color: 'var(--primary-hover)' }}>↺{h.eventsUpdated}</span>
                  <span style={{ color: 'var(--error)' }}>−{h.eventsDeleted}</span>
                  <span>skip:{h.eventsSkipped}</span>
                  {h.completedAt && <span>{duration(h.startedAt, h.completedAt)}</span>}
                  {h.errorMessage && <span style={{ color: 'var(--error)' }}>{h.errorMessage}</span>}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                <div>{new Date(h.startedAt).toLocaleDateString()}</div>
                <div>{new Date(h.startedAt).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
