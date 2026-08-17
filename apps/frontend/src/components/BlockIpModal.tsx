import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, X, Bot } from 'lucide-react';
import { NetworkConnection } from '@network-monitor/shared';

export interface BlockIpModalProps {
  connection: NetworkConnection | null;
  targetIp: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBlock: (ip: string, comment?: string) => Promise<boolean>;
}

export const BlockIpModal: React.FC<BlockIpModalProps> = ({
  connection,
  targetIp,
  isOpen,
  onClose,
  onConfirmBlock,
}) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !targetIp) return null;

  // Check if private / LAN IP
  const isPrivate =
    targetIp.startsWith('192.168.') ||
    targetIp.startsWith('10.') ||
    targetIp.startsWith('172.16.') ||
    targetIp.startsWith('172.20.') ||
    targetIp.startsWith('172.31.') ||
    targetIp.startsWith('169.254.') ||
    targetIp.startsWith('fe80:');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const success = await onConfirmBlock(targetIp, comment);
    setIsSubmitting(false);

    if (success) {
      setComment('');
      onClose();
    } else {
      setErrorMessage('Failed to apply PF firewall block rule. Check backend logs.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: 'var(--accent-rose)', display: 'flex' }}>
              <ShieldAlert size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Block Remote IP Address</h3>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '14px', borderRadius: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target IP:</span>
              <strong className="font-mono" style={{ color: 'var(--accent-rose)' }}>{targetIp}</strong>

              {connection && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>Protocol / Port:</span>
                  <span className="font-mono">{connection.protocol} : {connection.remotePort || '*'}</span>

                  <span style={{ color: 'var(--text-muted)' }}>Process:</span>
                  <span>{connection.processName} (PID: {connection.pid})</span>

                  {connection.isAiAgent && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>AI Runtime:</span>
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Bot size={14} /> {connection.aiAgentName || 'AI Agent'}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Private IP Warning */}
          {isPrivate && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '12px 14px',
                borderRadius: '8px',
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                fontSize: '0.84rem',
                color: '#fbbf24',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Private / Local Network Warning:</strong> This is a local network address. Blocking it may prevent your Mac from communicating with local devices or gateways.
              </div>
            </div>
          )}

          {/* System-wide Scope Warning */}
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: '#fda4af',
              lineHeight: 1.4,
            }}
          >
            <strong>Warning:</strong> PF firewall rules are <strong>system-wide</strong>. Blocking this IP address will drop traffic for <em>all applications and processes</em> communicating with this remote address, not just the selected socket.
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Comment / Reason (Optional):
            </label>
            <input
              type="text"
              className="search-input"
              style={{
                width: '100%',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.88rem',
              }}
              placeholder="e.g. Block suspicious telemetry endpoint"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>

          {errorMessage && (
            <div style={{ color: 'var(--accent-rose)', fontSize: '0.82rem' }}>
              {errorMessage}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="action-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-btn"
              disabled={isSubmitting}
              style={{
                background: 'rgba(244, 63, 94, 0.2)',
                borderColor: 'rgba(244, 63, 94, 0.4)',
                color: '#fb7185',
                fontWeight: 700,
              }}
            >
              {isSubmitting ? 'Applying Rule...' : 'Confirm Block IP'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
