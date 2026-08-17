import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Activity, ArrowRight, ShieldAlert } from 'lucide-react';

export const FirstRunModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const acknowledged = localStorage.getItem('nm_first_run_ack_v1');
    if (!acknowledged) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('nm_first_run_ack_v1', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '28px',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div className="empty-icon-wrap" style={{ background: 'rgba(0, 240, 255, 0.15)', borderColor: 'var(--accent-cyan)' }}>
            <Activity size={24} color="var(--accent-cyan)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Welcome to AgentLens</h3>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Local real-time socket discovery, AI agent intelligence & traffic analysis
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
          <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <ShieldCheck size={18} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>100% On-Device & Private:</strong> All socket discovery, packet metrics, and history stay strictly on this Mac. No telemetry or external APIs are used.
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Lock size={18} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Loopback Exclusivity:</strong> The backend and WebSocket servers bind exclusively to <code>127.0.0.1</code>.
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <ShieldAlert size={18} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Safe Firewall Controls:</strong> IP blocking operates inside a dedicated PF anchor (<code>com.networkmonitor.app</code>) without touching global rules.
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            className="action-btn active"
            onClick={handleDismiss}
            style={{
              padding: '8px 20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              gap: '8px',
              background: 'var(--accent-cyan)',
              color: '#000',
              borderColor: 'var(--accent-cyan)',
            }}
          >
            <span>Start Monitoring</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
