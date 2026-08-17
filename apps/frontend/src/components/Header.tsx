import React from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { StatusBadge } from './StatusBadge.js';
import { WsConnectionStatus } from '../hooks/useWebSocket.js';
import { HealthStatus } from '../hooks/useBackendHealth.js';

export interface HeaderProps {
  wsStatus: WsConnectionStatus;
  latencyMs: number | null;
  healthStatus: HealthStatus;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsStatus,
  latencyMs,
  healthStatus,
  onRefresh,
}) => {
  return (
    <header className="glass-panel header-wrapper">
      <div className="brand-section">
        <div className="brand-icon-halo">
          <div className="brand-icon-inner">
            <img src="/logo.png" alt="AgentLens" />
          </div>
        </div>
        <div>
          <div className="brand-title">
            <span className="brand-title-gradient">AgentLens</span>
            <span className="brand-version-badge">v2.0 PRO</span>
          </div>
          <div className="brand-subtitle">
            <Radio size={13} color="#00f0ff" className="spin-slow" />
            <span>AI Agent Security & Activity Observability (127.0.0.1)</span>
          </div>
        </div>
      </div>

      <div className="status-group">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            color: '#34d399',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          <span className="status-dot active" />
          <span>REALTIME OBSERVABILITY</span>
        </div>

        <StatusBadge
          label={`API: ${healthStatus.toUpperCase()}`}
          state={healthStatus === 'healthy' ? 'healthy' : healthStatus === 'checking' ? 'connecting' : 'unhealthy'}
        />

        <StatusBadge
          label={`WS: ${wsStatus.toUpperCase()}`}
          state={wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'disconnected'}
          subText={latencyMs !== null ? `${latencyMs}ms` : undefined}
        />

        <button
          className="action-btn"
          onClick={onRefresh}
          title="Trigger manual ping & health check"
          style={{ padding: '6px 12px', fontSize: '0.78rem' }}
        >
          <RefreshCw size={13} />
          <span>Ping</span>
        </button>
      </div>
    </header>
  );
};
