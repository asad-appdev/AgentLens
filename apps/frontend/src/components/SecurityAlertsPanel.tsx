import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ShieldCheck,
  Search,
  Trash2,
  CheckCircle,
  HelpCircle,
  Activity,
  Ban,
} from 'lucide-react';
import { SecurityAlert } from '@network-monitor/shared';

export interface SecurityAlertsPanelProps {
  alerts: SecurityAlert[];
  onInvestigate: (targetId: string) => void;
  onBlockIp: (ip: string) => void;
  onKillPid: (pid: number, processName: string) => void;
  onDismiss: (alertId: string) => void;
  onTrust: (type: 'domain' | 'ip' | 'process', value: string, alertId?: string) => void;
}

export const SecurityAlertsPanel: React.FC<SecurityAlertsPanelProps> = ({
  alerts,
  onInvestigate,
  onBlockIp,
  onKillPid,
  onDismiss,
  onTrust,
}) => {
  if (alerts.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, rgba(8, 12, 20, 0.8) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            padding: 18,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            color: '#10b981',
            marginBottom: 16,
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)',
          }}
        >
          <ShieldCheck size={48} />
        </div>
        <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>
          All Systems Secure — No Active Threats
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: 520, margin: '0 auto 20px', lineHeight: 1.6 }}>
          Deterministic correlation engine is continuously monitoring active AI agent runtimes, child process trees, and outbound destinations in real time.
        </p>
        <div style={{ display: 'inline-flex', gap: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>✓ Zero sensitive content stored</span>
          <span>•</span>
          <span>✓ 100% Local correlation</span>
          <span>•</span>
          <span>✓ Non-destructive by default</span>
        </div>
      </div>
    );
  }

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
      case 'HIGH':
        return (
          <span
            style={{
              background: 'rgba(244, 63, 94, 0.18)',
              color: '#f43f5e',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f43f5e' }} />
            HIGH RISK
          </span>
        );
      case 'MEDIUM':
        return (
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            MEDIUM
          </span>
        );
      default:
        return (
          <span
            style={{
              background: 'rgba(56, 189, 248, 0.18)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38bdf8' }} />
            LOW / INFO
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {alerts.map((alert) => {
        const isHigh = alert.severity === 'HIGH' || alert.severity === 'CRITICAL';
        const isMed = alert.severity === 'MEDIUM';
        const borderColor = isHigh ? '#f43f5e' : isMed ? '#f59e0b' : '#38bdf8';

        return (
          <div
            key={alert.id}
            className="glass-panel"
            style={{
              padding: 24,
              borderLeft: `5px solid ${borderColor}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: isHigh
                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.05) 0%, rgba(13, 20, 36, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(13, 20, 36, 0.9) 0%, rgba(19, 29, 52, 0.8) 100%)',
            }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 'var(--radius-md)',
                    background: `${borderColor}18`,
                    border: `1px solid ${borderColor}35`,
                    color: borderColor,
                  }}
                >
                  {isHigh ? <ShieldAlert size={24} /> : isMed ? <AlertTriangle size={24} /> : <Info size={24} />}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    {alert.title}
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>Target: <strong style={{ color: '#f8fafc' }}>{alert.agentName || alert.processName}</strong></span>
                    <span className="code-chip">PID {alert.pid}</span>
                    <span>•</span>
                    <span>Observed: {new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                  }}
                >
                  Confidence: <strong style={{ color: '#00f0ff' }}>{Math.round(alert.confidence * 100)}%</strong>
                </div>
                {getSeverityBadge(alert.severity)}
              </div>
            </div>

            {/* Observable Evidence Block */}
            <div
              style={{
                background: 'rgba(5, 8, 16, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ fontWeight: 700, color: '#94a3b8', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={13} color="#00f0ff" />
                <span>Observed Telemetry Evidence</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {alert.evidence.map((ev, idx) => (
                  <li key={idx}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#a5f3fc' }}>{ev}</code>
                  </li>
                ))}
              </ul>
            </div>

            {/* 5-Question Dual Column Explanations */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, fontSize: '0.84rem' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.22)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <AlertTriangle size={13} />
                  <span>Why Flagged Suspicious</span>
                </div>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{alert.whySuspicious}</span>
              </div>

              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid rgba(56, 189, 248, 0.22)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <HelpCircle size={13} />
                  <span>Observation Limits (What Is Unknown)</span>
                </div>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{alert.whatIsUnknown}</span>
              </div>
            </div>

            {/* Recommendation Callout */}
            <div
              style={{
                fontSize: '0.84rem',
                background: 'rgba(16, 185, 129, 0.08)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <ShieldCheck size={18} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Recommended Next Step: </span>
                <span style={{ color: '#e2e8f0', lineHeight: 1.5 }}>{alert.recommendation}</span>
              </div>
            </div>

            {/* Response Action Tray */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                paddingTop: 10,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <button
                className="action-btn"
                onClick={() => onInvestigate(alert.id)}
                style={{
                  background: 'rgba(0, 240, 255, 0.12)',
                  color: '#00f0ff',
                  borderColor: 'rgba(0, 240, 255, 0.35)',
                }}
                title="Open AI Investigator for structured facts and inferences"
              >
                <Search size={14} />
                <span>AI Investigate</span>
              </button>

              {alert.actions?.find((a) => a.type === 'BLOCK_DESTINATION') && (
                <button
                  className="action-btn"
                  onClick={() => {
                    const blockAct = alert.actions.find((a) => a.type === 'BLOCK_DESTINATION');
                    if (blockAct) onBlockIp(blockAct.targetId);
                  }}
                  style={{
                    background: 'rgba(245, 158, 11, 0.14)',
                    color: '#fbbf24',
                    borderColor: 'rgba(245, 158, 11, 0.35)',
                  }}
                  title="Block destination IP via firewall"
                >
                  <Ban size={14} />
                  <span>Block Destination</span>
                </button>
              )}

              {alert.category === 'data_exposure' && (
                <button
                  className="action-btn"
                  onClick={() => onTrust('process', alert.processName, alert.id)}
                  style={{
                    background: 'rgba(16, 185, 129, 0.14)',
                    color: '#34d399',
                    borderColor: 'rgba(16, 185, 129, 0.35)',
                  }}
                  title="Mark this process as explicitly trusted"
                >
                  <CheckCircle size={14} />
                  <span>Mark Trusted</span>
                </button>
              )}

              <button
                className="action-btn"
                onClick={() => onKillPid(alert.pid, alert.processName)}
                style={{
                  background: 'rgba(244, 63, 94, 0.14)',
                  color: '#fb7185',
                  borderColor: 'rgba(244, 63, 94, 0.35)',
                }}
                title="Terminate the agent process (requires confirmation)"
              >
                <Trash2 size={14} />
                <span>Kill Agent</span>
              </button>

              <button
                className="action-btn"
                onClick={() => onDismiss(alert.id)}
                style={{ color: 'var(--text-muted)' }}
              >
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
