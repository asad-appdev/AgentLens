import React, { useState } from 'react';
import {
  FileCode,
  ShieldCheck,
  Key,
  Cloud,
  Terminal,
  Lock,
  FileText,
  Filter,
} from 'lucide-react';
import { SensitiveFileAccess, SensitiveFileCategory } from '@network-monitor/shared';

export interface SensitiveFilesPanelProps {
  files: SensitiveFileAccess[];
}

export const SensitiveFilesPanel: React.FC<SensitiveFilesPanelProps> = ({ files }) => {
  const [selectedCategory, setSelectedCategory] = useState<SensitiveFileCategory | 'ALL'>('ALL');

  const filteredFiles = files.filter((f) => {
    if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
    return true;
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'credentials':
        return <Key size={15} color="#f43f5e" />;
      case 'ssh':
        return <Lock size={15} color="#f59e0b" />;
      case 'cloud':
        return <Cloud size={15} color="#00f0ff" />;
      case 'git':
      case 'tokens':
        return <Terminal size={15} color="#a855f7" />;
      case 'certificates':
        return <FileText size={15} color="#10b981" />;
      default:
        return <FileCode size={15} color="#94a3b8" />;
    }
  };

  const categories = [
    { id: 'ALL', label: 'All Resources', count: files.length },
    { id: 'credentials', label: 'Credentials & .env', count: files.filter((f) => f.category === 'credentials').length },
    { id: 'ssh', label: 'SSH Keys', count: files.filter((f) => f.category === 'ssh').length },
    { id: 'cloud', label: 'Cloud Configs', count: files.filter((f) => f.category === 'cloud').length },
    { id: 'git', label: 'Git & Config', count: files.filter((f) => f.category === 'git').length },
    { id: 'tokens', label: 'Tokens & npmrc', count: files.filter((f) => f.category === 'tokens').length },
    { id: 'certificates', label: 'Certificates', count: files.filter((f) => f.category === 'certificates').length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Privacy Guarantee Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(13, 20, 36, 0.85) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 0 25px rgba(16, 185, 129, 0.1)',
        }}
      >
        <div
          style={{
            padding: 10,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
          }}
        >
          <ShieldCheck size={26} />
        </div>
        <div>
          <h4 style={{ margin: '0 0 3px', fontSize: '1rem', fontWeight: 800, color: '#34d399', letterSpacing: '-0.01em' }}>
            Zero-Content Privacy Guarantee
          </h4>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Agent Lens strictly tracks file path metadata only. <strong>No file contents, secret tokens, passwords, or cryptographic private keys</strong> are ever read, stored in SQLite, or transmitted.
          </span>
        </div>
      </div>

      {/* Filter Category Pills */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.78rem', paddingLeft: 6 }}>
          <Filter size={14} />
          <span>Category:</span>
        </div>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className="action-btn"
            onClick={() => setSelectedCategory(cat.id as any)}
            style={{
              padding: '5px 12px',
              fontSize: '0.78rem',
              borderRadius: 'var(--radius-full)',
              background: selectedCategory === cat.id ? 'rgba(0, 240, 255, 0.14)' : 'rgba(255, 255, 255, 0.03)',
              borderColor: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
              color: selectedCategory === cat.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontWeight: selectedCategory === cat.id ? 700 : 600,
            }}
          >
            <span>{cat.label}</span>
            <span
              style={{
                fontSize: '0.7rem',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                background: selectedCategory === cat.id ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              }}
            >
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Files Data Table */}
      {filteredFiles.length === 0 ? (
        <div className="glass-panel empty-state-box">
          <div className="empty-icon-wrap">
            <FileCode size={32} />
          </div>
          <h4 className="empty-title">No Sensitive Resource Accesses Recorded</h4>
          <p className="empty-desc">
            No agent or process has accessed credentials, SSH keys, or cloud configs in the current session.
          </p>
        </div>
      ) : (
        <div className="glass-panel table-wrapper" style={{ padding: 0 }}>
          <table className="connections-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Category</th>
                <th>Sanitized Path</th>
                <th style={{ width: 220 }}>Accessed By</th>
                <th style={{ width: 130 }}>Sensitivity</th>
                <th style={{ width: 130 }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {getCategoryIcon(file.category)}
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.82rem' }}>
                        {file.category}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="code-chip">{file.path}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong style={{ color: '#f8fafc', fontSize: '0.86rem' }}>{file.accessedBy}</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.05)', padding: '1px 5px', borderRadius: 4 }}>
                        PID {file.pid}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background:
                          file.sensitivity === 'critical' || file.sensitivity === 'high'
                            ? 'rgba(244, 63, 94, 0.16)'
                            : 'rgba(245, 158, 11, 0.16)',
                        color:
                          file.sensitivity === 'critical' || file.sensitivity === 'high'
                            ? '#fb7185'
                            : '#fbbf24',
                        border: `1px solid ${
                          file.sensitivity === 'critical' || file.sensitivity === 'high'
                            ? 'rgba(244, 63, 94, 0.35)'
                            : 'rgba(245, 158, 11, 0.35)'
                        }`,
                      }}
                    >
                      {file.sensitivity}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    {new Date(file.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
