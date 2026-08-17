import React, { useState } from 'react';
import {
  SystemDiagnosticsReport,
  BackupMetadata,
} from '@network-monitor/shared';
import {
  X,
  Cpu,
  Download,
  RotateCcw,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters.js';

export interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SystemDiagnosticsReport | null;
  backups: BackupMetadata[];
  isLoading: boolean;
  onRefresh: () => Promise<any>;
  onCreateBackup: () => Promise<any>;
  onRestoreBackup: (id: string) => Promise<boolean>;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  report,
  backups,
  isLoading,
  onRefresh,
  onCreateBackup,
  onRestoreBackup,
}) => {
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    if (window.confirm(`Restore backup snapshot "${id}"? A safety backup will be created first.`)) {
      setRestoreStatus('Restoring...');
      const success = await onRestoreBackup(id);
      setRestoreStatus(success ? 'Backup restored successfully!' : 'Failed to restore backup.');
      setTimeout(() => setRestoreStatus(null), 4000);
    }
  };

  const getStatusDot = (state?: string) => {
    switch (state) {
      case 'running':
        return <span className="status-dot active" style={{ width: '8px', height: '8px' }} />;
      case 'paused':
        return <span className="status-dot" style={{ width: '8px', height: '8px', background: '#fbbf24' }} />;
      case 'unavailable':
      case 'error':
        return <span className="status-dot" style={{ width: '8px', height: '8px', background: 'var(--accent-rose)' }} />;
      default:
        return <span className="status-dot" style={{ width: '8px', height: '8px', background: 'var(--text-muted)' }} />;
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Cpu size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>System Health & Diagnostics</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="action-btn" onClick={onRefresh} disabled={isLoading} style={{ padding: '4px 8px' }}>
              <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            </button>
            <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* System Monitor Statuses */}
        {report && (
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {Object.entries(report.monitors).map(([name, state]) => (
              <div key={name} className="glass-panel" style={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{name}</span>
                  {getStatusDot(state)}
                </div>
                <div className="font-mono" style={{ fontSize: '0.82rem', marginTop: '4px', textTransform: 'uppercase', color: state === 'running' ? '#34d399' : '#fbbf24' }}>
                  {state}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Diagnostics Summary */}
        {report && (
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', fontSize: '0.84rem', lineHeight: 1.6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>App Version: <strong style={{ color: 'var(--text-primary)' }}>v{report.appVersion}</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Platform: <strong style={{ color: 'var(--text-primary)' }}>{report.platform} ({report.architecture})</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Node Version: <strong style={{ color: 'var(--text-primary)' }}>{report.nodeVersion}</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Uptime: <strong style={{ color: 'var(--text-primary)' }}>{Math.floor(report.uptimeSeconds / 60)} min</strong></div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)' }}>Memory (RSS): <strong style={{ color: 'var(--text-primary)' }}>{report.memoryUsageMb.rss} MB</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>Heap Used: <strong style={{ color: 'var(--text-primary)' }}>{report.memoryUsageMb.heapUsed} MB</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>SQLite Size: <strong style={{ color: 'var(--text-primary)' }}>{report.database.sizeFormatted}</strong></div>
                <div style={{ color: 'var(--text-muted)' }}>PF Firewall: <strong style={{ color: 'var(--text-primary)' }}>{report.firewall.isAnchorLoaded ? 'Active Anchor' : 'Standby'} ({report.firewall.blockedIpCount} blocked)</strong></div>
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
              <a
                href="/api/diagnostics/export"
                download
                className="action-btn"
                style={{ fontSize: '0.78rem', gap: '6px', textDecoration: 'none' }}
              >
                <Download size={13} /> Export Sanitized Report JSON
              </a>
            </div>
          </div>
        )}

        {/* Backup & Restore Section */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Archive size={16} color="var(--accent-cyan)" /> Local Backups & Restores
            </div>
            <button className="action-btn" onClick={onCreateBackup} style={{ fontSize: '0.75rem', gap: '4px' }}>
              <Archive size={12} /> Create Backup Snapshot
            </button>
          </div>

          {restoreStatus && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-cyan)', fontSize: '0.8rem', marginBottom: '10px' }}>
              {restoreStatus}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
            {backups.length > 0 ? (
              backups.map((bak) => (
                <div
                  key={bak.id}
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
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{bak.id}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {new Date(bak.timestamp).toLocaleString()} &bull; {formatBytes(bak.databaseSizeBytes)}
                    </div>
                  </div>
                  <button
                    className="action-btn"
                    onClick={() => handleRestore(bak.id)}
                    style={{ fontSize: '0.72rem', padding: '2px 8px', gap: '4px' }}
                  >
                    <RotateCcw size={11} /> Restore
                  </button>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center', padding: '12px' }}>
                No backup snapshots found. Click &quot;Create Backup Snapshot&quot; to save metadata.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
