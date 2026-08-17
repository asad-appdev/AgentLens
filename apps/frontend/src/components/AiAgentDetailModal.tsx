import React, { useState } from 'react';
import { AiAgentProfile } from '@network-monitor/shared';
import {
  X,
  Bot,
  Pin,
  ShieldAlert,
} from 'lucide-react';
import { formatBytes, formatBytesPerSec } from '../utils/formatters.js';

export interface AiAgentDetailModalProps {
  profile: AiAgentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onInitiateBlockIp?: (ip: string) => void;
  onPinItem?: (item: { type: any; targetId: string; title: string }) => void;
}

export const AiAgentDetailModal: React.FC<AiAgentDetailModalProps> = ({
  profile,
  isOpen,
  onClose,
  onInitiateBlockIp,
  onPinItem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'ENDPOINTS' | 'SESSIONS'>('OVERVIEW');

  if (!isOpen || !profile) return null;

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
        zIndex: 2000,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{profile.displayName}</h3>
              <span className="badge badge-connected" style={{ gap: '4px' }}>
                <Bot size={13} /> {profile.category} &bull; {profile.confidence}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Observed start: {new Date(profile.observedStart).toLocaleString()}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {onPinItem && (
              <button
                className="action-btn"
                onClick={() => onPinItem({ type: 'agent', targetId: profile.agentId, title: profile.displayName })}
                style={{ fontSize: '0.74rem', gap: '4px' }}
              >
                <Pin size={12} /> Pin Target
              </button>
            )}
            <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginBottom: '16px' }}>
          <button
            className={`action-btn ${activeSubTab === 'OVERVIEW' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('OVERVIEW')}
            style={{ fontSize: '0.8rem' }}
          >
            Overview & Metrics
          </button>
          <button
            className={`action-btn ${activeSubTab === 'ENDPOINTS' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('ENDPOINTS')}
            style={{ fontSize: '0.8rem' }}
          >
            Remote Endpoints ({profile.recentEndpoints.length})
          </button>
        </div>

        {/* Overview Tab */}
        {activeSubTab === 'OVERVIEW' && (
          <div>
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <div className="glass-panel" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Throughput</div>
                <div className="font-mono" style={{ fontSize: '0.86rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
                  ↓ {formatBytesPerSec(profile.currentDownloadRate)}
                </div>
                <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
                  ↑ {formatBytesPerSec(profile.currentUploadRate)}
                </div>
              </div>

              <div className="glass-panel" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Historical Total</div>
                <div className="font-mono" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formatBytes(profile.downloadBytes + profile.uploadBytes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatBytes(profile.downloadBytes)} down</div>
              </div>

              <div className="glass-panel" style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Open Sockets</div>
                <div className="font-mono" style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', marginTop: '2px' }}>
                  {profile.connectionsCount}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{profile.remoteHostsCount} Remote Hosts</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '14px', fontSize: '0.82rem', lineHeight: 1.6 }}>
              <div>Active PIDs: <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{profile.pids.join(', ') || 'None'}</strong></div>
              <div>Listening Ports: <strong className="font-mono" style={{ color: 'var(--accent-emerald)' }}>{profile.listeningPorts.join(', ') || 'Dynamic/None'}</strong></div>
              <div>Detection Sources: <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{profile.detectionSources.join(', ') || 'Signature'}</span></div>
            </div>
          </div>
        )}

        {/* Endpoints Tab */}
        {activeSubTab === 'ENDPOINTS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
            {profile.recentEndpoints.length > 0 ? (
              profile.recentEndpoints.map((ep) => (
                <div
                  key={`${ep.ip}:${ep.port}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.8rem',
                  }}
                >
                  <div>
                    <span className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{ep.ip}:{ep.port}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '8px' }}>({ep.protocol})</span>
                  </div>
                  {onInitiateBlockIp && (
                    <button
                      className="action-btn"
                      onClick={() => onInitiateBlockIp(ep.ip)}
                      style={{ fontSize: '0.72rem', padding: '2px 8px', color: '#fb7185' }}
                    >
                      <ShieldAlert size={11} /> Block IP
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '20px' }}>
                No active remote endpoints for this agent.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
