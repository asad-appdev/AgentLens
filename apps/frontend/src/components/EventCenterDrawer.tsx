import React from 'react';
import { LocalNotificationEvent } from '@network-monitor/shared';
import { Bell, Check, Trash2, X, Info, AlertTriangle, AlertCircle } from 'lucide-react';

export interface EventCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: LocalNotificationEvent[];
  unreadCount: number;
  onMarkRead: () => Promise<void>;
  onClear: () => Promise<void>;
  onInspectProcess?: (pid: number) => void;
}

export const EventCenterDrawer: React.FC<EventCenterDrawerProps> = ({
  isOpen,
  onClose,
  events,
  unreadCount,
  onMarkRead,
  onClear,
  onInspectProcess,
}) => {
  if (!isOpen) return null;

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'WARNING':
        return <AlertTriangle size={15} color="#fbbf24" />;
      case 'ERROR':
        return <AlertCircle size={15} color="#fb7185" />;
      default:
        return <Info size={15} color="var(--accent-cyan)" />;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 1500,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100vh',
          borderRadius: 0,
          borderLeft: '1px solid var(--border-subtle)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Local Event Center</h3>
            {unreadCount > 0 && (
              <span className="badge badge-connected" style={{ fontSize: '0.72rem', padding: '1px 6px' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 6px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
          <button
            className="action-btn"
            onClick={onMarkRead}
            disabled={unreadCount === 0}
            style={{ fontSize: '0.76rem', padding: '4px 10px', gap: '4px' }}
          >
            <Check size={13} /> Mark all read
          </button>
          <button
            className="action-btn"
            onClick={onClear}
            disabled={events.length === 0}
            style={{ fontSize: '0.76rem', padding: '4px 10px', gap: '4px', color: 'var(--accent-rose)' }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>

        {/* Events List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {events.length > 0 ? (
            events.map((evt) => (
              <div
                key={evt.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: evt.read ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 240, 255, 0.08)',
                  border: `1px solid ${evt.read ? 'var(--border-subtle)' : 'rgba(0, 240, 255, 0.25)'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {getSeverityIcon(evt.severity)}
                    <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{evt.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {evt.message}
                </div>
                {evt.pid && onInspectProcess && (
                  <button
                    className="action-btn"
                    onClick={() => { onClose(); onInspectProcess(evt.pid!); }}
                    style={{ marginTop: '8px', fontSize: '0.72rem', padding: '2px 8px' }}
                  >
                    Inspect PID {evt.pid}
                  </button>
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No local events recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
