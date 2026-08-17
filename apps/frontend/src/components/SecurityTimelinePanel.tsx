import React, { useState } from 'react';
import {
  Clock,
  Filter,
  FileCode,
  Globe,
  Terminal,
  Shield,
  Layers,
  Search,
  Trash2,
} from 'lucide-react';
import { SecurityEvent } from '@network-monitor/shared';

export interface SecurityTimelinePanelProps {
  events: SecurityEvent[];
  onClearHistory: () => void;
}

export const SecurityTimelinePanel: React.FC<SecurityTimelinePanelProps> = ({
  events,
  onClearHistory,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = events.filter((e) => {
    if (selectedSeverity !== 'ALL' && e.severity !== selectedSeverity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.description.toLowerCase().includes(q) ||
        e.processName.toLowerCase().includes(q) ||
        (e.agentName && e.agentName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'FILE_ACCESS':
      case 'FILE_CHANGE':
        return <FileCode size={16} color="#00f0ff" />;
      case 'NETWORK_CONNECTION':
      case 'NETWORK_CLOSED':
        return <Globe size={16} color="#6366f1" />;
      case 'COMMAND_EXECUTED':
      case 'CHILD_PROCESS_CREATED':
        return <Terminal size={16} color="#f59e0b" />;
      case 'PACKAGE_INSTALLED':
        return <Layers size={16} color="#10b981" />;
      case 'PERSISTENCE_CHANGED':
      case 'SECURITY_ALERT':
        return <Shield size={16} color="#f43f5e" />;
      default:
        return <Clock size={16} color="#94a3b8" />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Controls Header */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <Filter size={14} />
            <span>Severity:</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map((sev) => (
              <button
                key={sev}
                className="action-btn"
                onClick={() => setSelectedSeverity(sev)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: 'var(--radius-full)',
                  background: selectedSeverity === sev ? 'rgba(0, 240, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: selectedSeverity === sev ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: selectedSeverity === sev ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  fontWeight: selectedSeverity === sev ? 700 : 600,
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Filter timeline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                width: 180,
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <button
            className="action-btn"
            onClick={onClearHistory}
            style={{
              color: '#fb7185',
              borderColor: 'rgba(244, 63, 94, 0.25)',
              background: 'rgba(244, 63, 94, 0.08)',
              fontSize: '0.78rem',
            }}
            title="Clear all recorded timeline security events"
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      {filteredEvents.length === 0 ? (
        <div className="glass-panel empty-state-box">
          <div className="empty-icon-wrap">
            <Clock size={32} />
          </div>
          <h4 className="empty-title">No Timeline Events Recorded</h4>
          <p className="empty-desc">
            {events.length === 0
              ? 'Security events will stream in real time as agents execute commands, access files, or open network sockets.'
              : 'No events match the active search or severity filters.'}
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredEvents.map((evt) => {
            const isHigh = evt.severity === 'HIGH' || evt.severity === 'CRITICAL';
            const isMed = evt.severity === 'MEDIUM';
            const borderCol = isHigh ? '#f43f5e' : isMed ? '#f59e0b' : '#00f0ff';

            return (
              <div
                key={evt.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderLeft: `4px solid ${borderCol}`,
                  transition: 'background 0.2s ease',
                }}
              >
                <div
                  style={{
                    padding: 8,
                    borderRadius: 'var(--radius-sm)',
                    background: `${borderCol}15`,
                    marginTop: 1,
                  }}
                >
                  {getEventIcon(evt.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                        {evt.agentName || evt.processName}
                      </span>
                      <span className="code-chip">PID {evt.pid}</span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                        }}
                      >
                        {evt.type}
                      </span>
                    </div>

                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {evt.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
