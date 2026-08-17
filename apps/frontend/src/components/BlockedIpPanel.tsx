import React, { useState } from 'react';
import { BlockedIp, FirewallStatus } from '@network-monitor/shared';
import { ShieldCheck, ShieldAlert, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export interface BlockedIpPanelProps {
  blockedIps: BlockedIp[];
  status: FirewallStatus | null;
  onBlockIp: (ip: string, comment?: string) => Promise<{ success: boolean; error?: string }>;
  onUnblockIp: (ip: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
}

export const BlockedIpPanel: React.FC<BlockedIpPanelProps> = ({
  blockedIps,
  status,
  onBlockIp,
  onUnblockIp,
  isLoading,
}) => {
  const [manualIp, setManualIp] = useState('');
  const [manualComment, setManualComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleManualBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualIp.trim()) return;

    setActionError(null);
    setActionSuccess(null);

    const res = await onBlockIp(manualIp.trim(), manualComment.trim() || undefined);
    if (res.success) {
      setActionSuccess(`IP ${manualIp.trim()} blocked successfully.`);
      setManualIp('');
      setManualComment('');
    } else {
      setActionError(res.error || 'Failed to block IP');
    }
  };

  const handleUnblock = async (ip: string) => {
    if (!confirm(`Are you sure you want to unblock ${ip} from the PF firewall?`)) return;

    setActionError(null);
    setActionSuccess(null);

    const res = await onUnblockIp(ip);
    if (res.success) {
      setActionSuccess(`IP ${ip} unblocked successfully.`);
    } else {
      setActionError(res.error || 'Failed to unblock IP');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Firewall Anchor Status Banner */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: status?.isAnchorLoaded ? 'var(--accent-emerald)' : 'var(--accent-amber)', display: 'flex' }}>
            {status?.isAnchorLoaded ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              macOS PF Firewall Anchor: <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{status?.anchorName || 'com.networkmonitor.app'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Isolated Application Rules &bull; Main /etc/pf.conf is strictly preserved untouched.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`badge ${status?.isAnchorLoaded ? 'badge-connected' : 'badge-connecting'}`}>
            <span className={`status-dot ${status?.isAnchorLoaded ? 'active' : 'warning'}`} />
            {status?.dryRunMode ? 'Simulation Mode' : status?.isAnchorLoaded ? 'Anchor Active' : 'Initializing'}
          </span>
          <span className="badge badge-neutral font-mono">
            {blockedIps.length} Blocked
          </span>
        </div>
      </div>

      {/* Manual IP Blocking Form */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} color="var(--accent-rose)" /> Block Specific IP Address
        </h4>

        <form onSubmit={handleManualBlock} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            className="search-input"
            style={{
              flex: '1 1 200px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.88rem',
            }}
            placeholder="Enter remote IP (e.g. 142.250.72.14 or 2001:4860:...)"
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
          />

          <input
            type="text"
            className="search-input"
            style={{
              flex: '1 1 200px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.88rem',
            }}
            placeholder="Optional comment / label"
            value={manualComment}
            onChange={(e) => setManualComment(e.target.value)}
          />

          <button
            type="submit"
            className="action-btn"
            disabled={isLoading || !manualIp.trim()}
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              borderColor: 'rgba(244, 63, 94, 0.35)',
              color: '#fb7185',
              padding: '8px 18px',
            }}
          >
            <ShieldAlert size={14} />
            <span>Block IP</span>
          </button>
        </form>

        {actionError && (
          <div style={{ marginTop: '10px', color: 'var(--accent-rose)', fontSize: '0.82rem' }}>
            {actionError}
          </div>
        )}

        {actionSuccess && (
          <div style={{ marginTop: '10px', color: 'var(--accent-emerald)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> {actionSuccess}
          </div>
        )}
      </div>

      {/* Blocked IP Table */}
      <div className="glass-panel table-wrapper">
        <table className="connections-table">
          <thead>
            <tr>
              <th>Blocked Remote IP</th>
              <th>IP Family</th>
              <th>Blocked At</th>
              <th>Comment / Reason</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {blockedIps.length > 0 ? (
              blockedIps.map((item) => (
                <tr key={item.id}>
                  <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>
                    {item.ip}
                  </td>
                  <td>
                    <span className="pill-tag">{item.family}</span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {new Date(item.blockedAt).toLocaleString()}
                  </td>
                  <td style={{ fontSize: '0.84rem', color: item.comment ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {item.comment || 'Manual Block'}
                  </td>
                  <td>
                    <span className="badge badge-connected" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                      <span className="status-dot active" />
                      Active Rule
                    </span>
                  </td>
                  <td>
                    <button
                      className="action-btn"
                      onClick={() => handleUnblock(item.ip)}
                      disabled={isLoading}
                      style={{ padding: '4px 10px', fontSize: '0.78rem', gap: '4px' }}
                      title="Remove IP from PF firewall anchor"
                    >
                      <Trash2 size={12} />
                      <span>Unblock</span>
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px 16px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No IP addresses are currently blocked in the application anchor.
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Use the form above or click &quot;Block IP&quot; in the Connections table.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
