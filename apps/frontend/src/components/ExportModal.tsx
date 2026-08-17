import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, X, ShieldCheck } from 'lucide-react';
import { HistoryTimeRange } from '@network-monitor/shared';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [selectedRange, setSelectedRange] = useState<HistoryTimeRange>('24h');

  if (!isOpen) return null;

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          maxWidth: '540px',
          padding: '24px',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: 'var(--accent-cyan)', display: 'flex' }}>
              <Download size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Export Network Activity & History</h3>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Time Range Selector */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            History Export Range:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['1h', '6h', '24h', '7d'] as HistoryTimeRange[]).map((r) => (
              <button
                key={r}
                className={`action-btn ${selectedRange === r ? 'active' : ''}`}
                onClick={() => setSelectedRange(r)}
                style={{
                  flex: 1,
                  background: selectedRange === r ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: selectedRange === r ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: selectedRange === r ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  justifyContent: 'center',
                }}
              >
                {r === '1h' ? 'Last 1h' : r === '6h' ? 'Last 6h' : r === '24h' ? 'Last 24h' : 'Last 7 Days'}
              </button>
            ))}
          </div>
        </div>

        {/* Export Options Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {/* Snapshot JSON */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileJson size={16} color="var(--accent-cyan)" /> Live Snapshot (JSON)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                All current sockets, processes, traffic, and firewall rules
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => handleDownload('/api/export/snapshot')}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Download size={13} /> JSON
            </button>
          </div>

          {/* Connections CSV */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="var(--accent-emerald)" /> Historical Connections (CSV)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                RFC 4180 CSV with timestamps, PIDs, remote IPs, ports, and states
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => handleDownload(`/api/export/history?format=csv&type=connections&range=${selectedRange}`)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          {/* Traffic Timeline CSV */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileSpreadsheet size={16} color="var(--accent-emerald)" /> Traffic Timeline (CSV)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Time-series download and upload rates per interval
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => handleDownload(`/api/export/history?format=csv&type=traffic&range=${selectedRange}`)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          {/* Full History JSON */}
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileJson size={16} color="var(--accent-cyan)" /> Complete History (JSON)
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Structured payload with metadata, summary, sockets, and processes
              </div>
            </div>
            <button
              className="action-btn"
              onClick={() => handleDownload(`/api/export/history?format=json&range=${selectedRange}`)}
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
            >
              <Download size={13} /> JSON
            </button>
          </div>
        </div>

        {/* Local Security Guarantee */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '10px 14px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.8rem',
            color: '#a7f3d0',
          }}
        >
          <ShieldCheck size={16} style={{ flexShrink: 0 }} />
          <span>Local-Only: Exports are generated directly in-memory on your Mac. No network telemetry or external servers are involved.</span>
        </div>
      </div>
    </div>
  );
};
