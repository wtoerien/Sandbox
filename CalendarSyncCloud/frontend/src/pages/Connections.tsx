import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getConnections, connectGoogle, connectMicrosoft, connectApple,
  disconnectProvider, refreshCalendars,
} from '../api/client';
import type { Connection, Provider } from '../types';

function ProviderIcon({ provider }: { provider: Provider }) {
  const labels = { google: 'G', microsoft: 'M', apple: 'A' };
  return <div className={`provider-icon provider-${provider}`}>{labels[provider]}</div>;
}

function AppleModal({ onClose, onConnect }: { onClose: () => void; onConnect: (u: string, p: string, s?: string) => Promise<void> }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    setError('');
    try {
      await onConnect(username, password, serverUrl || undefined);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Connect Apple Calendar</div>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert alert-info" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--primary-hover)' }}>
              Use your Apple ID email and an <strong>app-specific password</strong> generated at appleid.apple.com.
            </div>
            <div className="form-row">
              <label>Apple ID Email</label>
              <input type="email" placeholder="you@icloud.com" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="form-row">
              <label>App-Specific Password</label>
              <input type="password" placeholder="xxxx-xxxx-xxxx-xxxx" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="form-row">
              <label>CalDAV Server URL (optional)</label>
              <input type="url" placeholder="https://caldav.icloud.com" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            </div>
            {error && <div className="form-error">{error}</div>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Connections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const location = useLocation();

  const load = useCallback(async () => {
    try { setConnections(await getConnections()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    if (connected) setNotification({ type: 'success', msg: `${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully!` });
    if (error) setNotification({ type: 'error', msg: `Connection failed. Check your OAuth credentials.` });
  }, [load, location.search]);

  const handleDisconnect = async (id: string, email: string) => {
    if (!confirm(`Disconnect ${email}? This will remove all associated calendars and sync rules.`)) return;
    await disconnectProvider(id);
    setNotification({ type: 'success', msg: 'Disconnected.' });
    load();
  };

  const handleRefresh = async (connectionId?: string) => {
    const key = connectionId || 'all';
    setRefreshing(key);
    try {
      const results = await refreshCalendars(connectionId);
      const total = results.reduce((acc: number, r: { count: number }) => acc + r.count, 0);
      setNotification({ type: 'success', msg: `Refreshed ${total} calendars.` });
    } catch {
      setNotification({ type: 'error', msg: 'Failed to refresh calendars.' });
    } finally {
      setRefreshing(null);
    }
  };

  const handleAppleConnect = async (username: string, password: string, serverUrl?: string) => {
    await connectApple(username, password, serverUrl);
    await load();
    await handleRefresh();
    setNotification({ type: 'success', msg: 'Apple Calendar connected!' });
  };

  const providers: { id: Provider; name: string; desc: string; action: () => void }[] = [
    { id: 'google', name: 'Google Calendar', desc: 'Connect via OAuth2', action: connectGoogle },
    { id: 'microsoft', name: 'Microsoft 365', desc: 'Connect via Azure OAuth2', action: connectMicrosoft },
    { id: 'apple', name: 'Apple Calendar', desc: 'Connect via CalDAV', action: () => setShowAppleModal(true) },
  ];

  const connectedProviders = new Set(connections.map((c) => c.provider));

  if (loading) return <div className="page"><div className="spinner" /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Connections</div>
          <div className="page-subtitle">Link your calendar accounts</div>
        </div>
        {connections.length > 0 && (
          <button className="btn-secondary btn-sm" onClick={() => handleRefresh()} disabled={refreshing === 'all'}>
            {refreshing === 'all' ? 'Refreshing…' : '⟳ Refresh All Calendars'}
          </button>
        )}
      </div>

      {notification && (
        <div className={`alert alert-${notification.type}`} style={{ marginBottom: '1rem' }}>
          {notification.msg}
        </div>
      )}

      <div className="section-title" style={{ marginBottom: '0.75rem' }}>Add Account</div>
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={p.action}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${connectedProviders.has(p.id) ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '0.5rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            className="btn-connect"
          >
            <ProviderIcon provider={p.id} />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', textAlign: 'left' }}>{p.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.desc}</div>
            </div>
            <div style={{ fontSize: '0.72rem', color: connectedProviders.has(p.id) ? 'var(--primary-hover)' : 'var(--text-muted)' }}>
              {connectedProviders.has(p.id) ? '✓ Connected (add another)' : '+ Connect'}
            </div>
          </button>
        ))}
      </div>

      {connections.length > 0 && (
        <>
          <div className="section-title" style={{ marginBottom: '0.75rem' }}>Connected Accounts</div>
          <div className="card" style={{ padding: 0 }}>
            {connections.map((conn) => (
              <div className="list-item" key={conn.id}>
                <ProviderIcon provider={conn.provider} />
                <div className="list-item-content">
                  <div className="list-item-title">{conn.displayName || conn.email}</div>
                  <div className="list-item-sub">
                    {conn.email} · {conn.provider.charAt(0).toUpperCase() + conn.provider.slice(1)}
                    · Connected {new Date(conn.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => handleRefresh(conn.id)}
                    disabled={refreshing === conn.id}
                  >
                    {refreshing === conn.id ? '…' : '⟳ Refresh'}
                  </button>
                  <button className="btn-danger btn-sm" onClick={() => handleDisconnect(conn.id, conn.email)}>
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {connections.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔗</div>
          <div className="empty-state-title">No accounts connected</div>
          <div className="empty-state-text">Connect at least two calendar accounts to start syncing.</div>
        </div>
      )}

      {showAppleModal && (
        <AppleModal onClose={() => setShowAppleModal(false)} onConnect={handleAppleConnect} />
      )}
    </div>
  );
}
