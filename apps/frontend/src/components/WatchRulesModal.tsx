import React, { useState } from 'react';
import { WatchRule, WatchTriggerType, WatchActionType } from '@network-monitor/shared';
import {
  X,
  Eye,
  Plus,
  Trash2,
  Bell,
  FileSearch,
} from 'lucide-react';

export interface WatchRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: WatchRule[];
  onCreateRule: (rule: Partial<WatchRule>) => Promise<any>;
  onDeleteRule: (id: string) => Promise<boolean>;
}

export const WatchRulesModal: React.FC<WatchRulesModalProps> = ({
  isOpen,
  onClose,
  rules,
  onCreateRule,
  onDeleteRule,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<'agent' | 'process'>('agent');
  const [targetName, setTargetName] = useState('Claude Code');
  const [triggerType, setTriggerType] = useState<WatchTriggerType>('NEW_ENDPOINT');
  const [action, setAction] = useState<WatchActionType>('NOTIFY');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetName.trim()) return;
    await onCreateRule({
      name: name.trim(),
      targetType,
      targetName: targetName.trim(),
      triggerType,
      action,
    });
    setName('');
    setIsCreating(false);
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
        zIndex: 2000,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Eye size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Automated Watch Rules (Non-Destructive)</h3>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Watch rules continuously observe background network and AI agent activity. Actions are strictly non-destructive (notifications, tagging, investigation creation).
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>Active Rules ({rules.length})</span>
          <button
            className="action-btn"
            onClick={() => setIsCreating(true)}
            style={{ fontSize: '0.75rem', gap: '4px' }}
          >
            <Plus size={13} /> Add Watch Rule
          </button>
        </div>

        {/* Create Rule Form */}
        {isCreating && (
          <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '16px', marginBottom: '16px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Create Non-Destructive Watch Trigger</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Rule Name</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  placeholder="e.g. Claude Code New Endpoint Watch"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Target Type</label>
                <select
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                >
                  <option value="agent">AI Agent Runtime</option>
                  <option value="process">Specific Process</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Target Name / Pattern</label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  placeholder="e.g. Claude Code, Ollama, or All"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Trigger Condition</label>
                <select
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value as any)}
                >
                  <option value="NEW_ENDPOINT">New Remote Endpoint Observed</option>
                  <option value="HIGH_THROUGHPUT">Throughput &gt; 10 MB/s</option>
                  <option value="SOCKET_COUNT">Socket Count &gt; 30</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Automated Safe Action</label>
                <select
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  value={action}
                  onChange={(e) => setAction(e.target.value as any)}
                >
                  <option value="NOTIFY">Send Local Notification</option>
                  <option value="CREATE_INVESTIGATION">Create Automated Investigation</option>
                  <option value="TAG_PROCESS">Add Watch Tag to Process</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" className="action-btn" onClick={() => setIsCreating(false)} style={{ fontSize: '0.78rem' }}>
                Cancel
              </button>
              <button type="submit" className="action-btn active" style={{ fontSize: '0.78rem' }}>
                Save Rule
              </button>
            </div>
          </form>
        )}

        {/* Rules List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rules.map((r) => (
            <div
              key={r.id}
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{r.name}</span>
                  <span className="badge badge-connected" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                    {r.action === 'NOTIFY' ? <Bell size={10} /> : <FileSearch size={10} />} {r.action}
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Target: <strong>{r.targetName}</strong> ({r.targetType}) &bull; Trigger: <strong>{r.triggerType}</strong> &bull; Fired {r.triggerCount} times
                </div>
              </div>

              <button
                className="action-btn"
                onClick={() => onDeleteRule(r.id)}
                style={{ color: 'var(--accent-rose)', padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
