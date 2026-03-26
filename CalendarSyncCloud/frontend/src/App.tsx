import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Connections from './pages/Connections';
import SyncRules from './pages/SyncRules';
import History from './pages/History';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◉' },
  { to: '/connections', label: 'Connections', icon: '⚡' },
  { to: '/rules', label: 'Sync Rules', icon: '↔' },
  { to: '/history', label: 'History', icon: '◷' },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('connected') || params.get('error')) {
      navigate('/connections', { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>📅</span>
          Calendar Sync
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Google · Microsoft 365 · Apple
          </div>
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/rules" element={<SyncRules />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
    </div>
  );
}
