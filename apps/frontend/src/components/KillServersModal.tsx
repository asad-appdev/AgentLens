import React, { useState } from 'react';
import { LocalServerInfo } from '@network-monitor/shared';
import { X, ShieldAlert, Server } from 'lucide-react';

export interface KillServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: LocalServerInfo[];
  onConfirm: (signal: 'SIGTERM' | 'SIGKILL') => Promise<void>;
  isTerminating?: boolean;
}

export const KillServersModal: React.FC<KillServersModalProps> = ({
  isOpen,
  onClose,
  targets,
  onConfirm,
  isTerminating = false,
}) => {
  const [signal, setSignal] = useState<'SIGTERM' | 'SIGKILL'>('SIGTERM');

  if (!isOpen || targets.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2200,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          border: '1px solid rgba(244, 63, 94, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldAlert size={22} color="#fb7185" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
              Confirm Termination ({targets.length} {targets.length === 1 ? 'Server' : 'Servers'})
            </h3>
          </div>
          <button className="action-btn" onClick={onClose} disabled={isTerminating} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          The following verified process{targets.length > 1 ? 'es' : ''} will be terminated and their listening ports released. Unrelated processes will not be affected.
        </p>

        {/* Process List Preview */}
        <div
          style={{
            maxHeight: '260px',
            overflowY: 'auto',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            marginBottom: '16px',
          }}
        >
          {targets.map((s) => (
            <div
              key={`${s.pid}-${s.port}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Server size={16} color="var(--accent-cyan)" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{s.processName}</strong>
                    <span className="badge badge-connected" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                      Port {s.port}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      PID {s.pid} {s.ppid ? `(PPID: ${s.ppid})` : ''}
                    </span>
                    <span className="badge badge-ai" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>
                      {s.serverType}
                    </span>
                  </div>
                  {s.commandLine && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '3px',
                        maxWidth: '460px',
                      }}
                      title={s.commandLine}
                    >
                      {s.commandLine}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Signal Options */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Termination Signal:</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="signal"
              value="SIGTERM"
              checked={signal === 'SIGTERM'}
              onChange={() => setSignal('SIGTERM')}
            />
            <span>Graceful (SIGTERM) - Recommended</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', cursor: 'pointer', color: '#fb7185' }}>
            <input
              type="radio"
              name="signal"
              value="SIGKILL"
              checked={signal === 'SIGKILL'}
              onChange={() => setSignal('SIGKILL')}
            />
            <span>Force Kill (SIGKILL -9)</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button className="action-btn" onClick={onClose} disabled={isTerminating} style={{ fontSize: '0.82rem' }}>
            Cancel
          </button>
          <button
            className="action-btn active"
            onClick={() => onConfirm(signal)}
            disabled={isTerminating}
            style={{
              fontSize: '0.82rem',
              background: 'var(--accent-rose)',
              borderColor: 'var(--accent-rose)',
              color: '#fff',
            }}
          >
            {isTerminating ? 'Terminating...' : `Confirm Termination (${targets.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};
