import React from 'react';
import { Clock, Activity, ChevronRight } from 'lucide-react';
import { SecurityEvent } from '@network-monitor/shared';


export interface RecentActivityFeedProps {
  events: SecurityEvent[];
  onSelectEvent?: (event: SecurityEvent) => void;
  maxItems?: number;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  events,
  onSelectEvent,
  maxItems = 8,
}) => {
  const displayEvents = events.slice(0, maxItems);

  const getEventBullet = (type: string, severity: string) => {
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      return <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f43f5e', boxShadow: '0 0 6px #f43f5e' }} />;
    }
    if (severity === 'MEDIUM') {
      return <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} />;
    }
    if (type.includes('FILE')) {
      return <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a855f7' }} />;
    }
    if (type.includes('NETWORK')) {
      return <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#38bdf8' }} />;
    }
    return <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />;
  };

  if (displayEvents.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={15} />
          <span>Real-time activity feed: Monitoring agent processes, file accesses, and socket transitions...</span>
        </div>
        <span className="status-dot active" style={{ width: 6, height: 6 }} />
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} color="#00f0ff" />
          <span>Recent Activity Feed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span className="status-dot active" style={{ width: 5, height: 5 }} />
          <span>LIVE STREAM</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
        {displayEvents.map((evt) => (
          <div
            key={evt.id}
            onClick={() => onSelectEvent && onSelectEvent(evt)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              cursor: onSelectEvent ? 'pointer' : 'default',
              fontSize: '0.78rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {getEventBullet(evt.type, evt.severity)}
              <span className="font-mono" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <strong style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {evt.agentName || evt.processName}
              </strong>
              <span
                style={{
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.75rem',
                }}
              >
                {evt.description}
              </span>
            </div>

            {onSelectEvent && <ChevronRight size={12} color="var(--text-dim)" style={{ flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </div>
  );
};
