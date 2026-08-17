import React, { useState } from 'react';
import { ProcessInspectorDetail } from '@network-monitor/shared';
import {
  X,
  Bot,
  Star,
  GitFork,
  Tag,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { formatBytes, formatBytesPerSec } from '../utils/formatters.js';

export interface ProcessInspectorModalProps {
  detail: ProcessInspectorDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (pid: number, name: string) => Promise<boolean>;
  onSetLabel: (key: string, label?: string) => Promise<void>;
  onSetTags: (key: string, tags: string[]) => Promise<void>;
  onBlockIp?: (ip: string) => void;
}

export const ProcessInspectorModal: React.FC<ProcessInspectorModalProps> = ({
  detail,
  isOpen,
  onClose,
  onToggleFavorite,
  onSetLabel,
  onSetTags,
  onBlockIp,
}) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [tagInput, setTagInput] = useState('');

  if (!isOpen || !detail) return null;

  const handleSaveLabel = async () => {
    await onSetLabel(detail.processName, labelText.trim() || undefined);
    setIsEditingLabel(false);
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    const nextTags = Array.from(new Set([...detail.tags, tagInput.trim()]));
    await onSetTags(detail.processName, nextTags);
    setTagInput('');
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const nextTags = detail.tags.filter((t) => t !== tagToRemove);
    await onSetTags(detail.processName, nextTags);
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
          maxWidth: '680px',
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
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{detail.processName}</h3>
              <span className="badge badge-neutral font-mono">PID {detail.pid}</span>

              {detail.isAiAgent && (
                <span className="badge badge-connected" style={{ gap: '4px' }}>
                  <Bot size={13} /> {detail.aiInfo.provider || 'AI Agent'} &bull; {detail.aiInfo.confidence} conf
                </span>
              )}

              <button
                className="action-btn"
                onClick={() => onToggleFavorite(detail.pid, detail.processName)}
                style={{ padding: '3px 6px', background: 'transparent', border: 'none' }}
                title={detail.isFavorite ? 'Remove Favorite' : 'Mark Favorite'}
              >
                <Star
                  size={16}
                  color={detail.isFavorite ? '#fbbf24' : 'var(--text-muted)'}
                  fill={detail.isFavorite ? '#fbbf24' : 'none'}
                />
              </button>
            </div>

            {/* Custom Label */}
            <div style={{ marginTop: '6px', fontSize: '0.84rem' }}>
              {isEditingLabel ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ padding: '2px 8px', fontSize: '0.8rem', width: '200px' }}
                    placeholder="e.g. Local LLM Runner"
                    value={labelText}
                    onChange={(e) => setLabelText(e.target.value)}
                  />
                  <button className="action-btn" onClick={handleSaveLabel} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                    Save
                  </button>
                  <button className="action-btn" onClick={() => setIsEditingLabel(false)} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <span
                  style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => {
                    setLabelText(detail.customLabel || '');
                    setIsEditingLabel(true);
                  }}
                >
                  Label: <strong style={{ color: 'var(--accent-cyan)' }}>{detail.customLabel || 'Click to set nickname...'}</strong>
                </span>
              )}
            </div>
          </div>

          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Behavior Indicators Bar */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {detail.behaviorIndicators.map((ind) => (
            <span key={ind} className="badge badge-neutral" style={{ fontSize: '0.75rem', gap: '4px' }}>
              <Info size={12} color="var(--accent-cyan)" /> {ind}
            </span>
          ))}
        </div>

        {/* KPI Metrics */}
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '18px' }}>
          <div className="glass-panel" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current Traffic</div>
            <div className="font-mono" style={{ fontSize: '0.88rem', color: 'var(--accent-emerald)', marginTop: '2px' }}>
              ↓ {formatBytesPerSec(detail.traffic.currentIn)}
            </div>
            <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>
              ↑ {formatBytesPerSec(detail.traffic.currentOut)}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Historical Total</div>
            <div className="font-mono" style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginTop: '2px' }}>
              {formatBytes(detail.traffic.totalIn + detail.traffic.totalOut)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Peak: {formatBytesPerSec(Math.max(detail.traffic.peakIn, detail.traffic.peakOut))}</div>
          </div>

          <div className="glass-panel" style={{ padding: '10px 12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Active Sockets</div>
            <div className="font-mono" style={{ fontSize: '0.95rem', color: 'var(--accent-blue)', marginTop: '2px' }}>
              {detail.activeConnectionsCount}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{detail.uniqueRemoteIps.length} Unique IPs</div>
          </div>
        </div>

        {/* Process Tree & Relationship */}
        <div className="glass-panel" style={{ padding: '14px 16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitFork size={15} /> Process Hierarchy Tree
          </div>
          <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
            {detail.parentProcess ? (
              <div style={{ color: 'var(--text-muted)' }}>
                Parent: <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{detail.parentProcess.processName}</strong> (PID {detail.parentProcess.pid})
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>Parent: Top-level / launchd</div>
            )}
            <div style={{ paddingLeft: '14px', borderLeft: '2px solid var(--accent-cyan)', margin: '4px 0' }}>
              <strong style={{ color: 'var(--accent-cyan)' }}>↳ {detail.processName}</strong> (PID {detail.pid}) [Target]
              {detail.childProcesses.length > 0 && (
                <div style={{ marginTop: '4px', paddingLeft: '12px' }}>
                  {detail.childProcesses.map((c) => (
                    <div key={c.pid} style={{ color: 'var(--text-secondary)' }}>
                      ↳ {c.processName} (PID {c.pid}) &bull; {c.activeSockets} sockets
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tag Management */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Tag size={13} /> Process Tags:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {detail.tags.map((t) => (
              <span key={t} className="pill-tag" style={{ fontSize: '0.75rem', gap: '4px' }}>
                {t}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(t)} />
              </span>
            ))}
            <form onSubmit={handleAddTag} style={{ display: 'inline-flex', gap: '4px' }}>
              <input
                type="text"
                className="search-input"
                style={{ padding: '2px 8px', fontSize: '0.75rem', width: '110px' }}
                placeholder="+ Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
              />
            </form>
          </div>
        </div>

        {/* Active Remote Endpoints */}
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Active Remote Endpoints Contacted:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {detail.uniqueRemoteIps.length > 0 ? (
              detail.uniqueRemoteIps.map((ip) => (
                <div key={ip} className="glass-panel" style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{ip}</span>
                  {onBlockIp && (
                    <button
                      className="action-btn"
                      onClick={() => onBlockIp(ip)}
                      style={{ padding: '2px 6px', fontSize: '0.68rem', color: '#fb7185' }}
                      title="Block IP in PF firewall anchor"
                    >
                      <ShieldAlert size={10} /> Block
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No remote endpoints currently active.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
