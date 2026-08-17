import React, { useState, useMemo } from 'react';
import { LocalServerInfo, KillProcessesResponse } from '@network-monitor/shared';
import {
  Server,
  RefreshCw,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { Pagination } from './Pagination.js';
import { KillServersModal } from './KillServersModal.js';

export interface LocalServersPanelProps {
  servers: LocalServerInfo[];
  isLoading: boolean;
  onRefresh: () => void;
  onKillProcesses: (pids?: number[], ports?: number[], signal?: 'SIGTERM' | 'SIGKILL') => Promise<KillProcessesResponse | null>;
}

export const LocalServersPanel: React.FC<LocalServersPanelProps> = ({
  servers,
  isLoading,
  onRefresh,
  onKillProcesses,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [devOnlyFilter, setDevOnlyFilter] = useState(false);
  const [selectedPids, setSelectedPids] = useState<Set<number>>(new Set());
  const [modalTargets, setModalTargets] = useState<LocalServerInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [resultBanner, setResultBanner] = useState<{ message: string; success: boolean } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredServers = useMemo(() => {
    return servers.filter((s) => {
      if (devOnlyFilter && !s.isDevServer) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.port.toString().includes(q) ||
        s.processName.toLowerCase().includes(q) ||
        s.pid.toString().includes(q) ||
        s.serverType.toLowerCase().includes(q) ||
        s.localAddress.toLowerCase().includes(q) ||
        (s.commandLine && s.commandLine.toLowerCase().includes(q))
      );
    });
  }, [servers, searchQuery, devOnlyFilter]);

  const devServersCount = servers.filter((s) => s.isDevServer).length;
  const infraCount = servers.filter((s) => !s.isDevServer).length;

  const paginatedServers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, currentPage, pageSize]);

  const toggleSelectPid = (pid: number) => {
    setSelectedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const selectAllDevServers = () => {
    // Select all external dev servers, protecting this Network Monitor application from accidental bulk kill
    const devPids = new Set(servers.filter((s) => s.isDevServer && !s.isSelf).map((s) => s.pid));
    setSelectedPids(devPids);
  };

  const toggleSelectAllFiltered = () => {
    if (selectedPids.size === filteredServers.length && filteredServers.length > 0) {
      setSelectedPids(new Set());
    } else {
      setSelectedPids(new Set(filteredServers.map((s) => s.pid)));
    }
  };

  const handleOpenKillSingle = (server: LocalServerInfo) => {
    setModalTargets([server]);
    setIsModalOpen(true);
  };

  const handleOpenKillSelected = () => {
    const targets = servers.filter((s) => selectedPids.has(s.pid));
    if (targets.length === 0) return;
    setModalTargets(targets);
    setIsModalOpen(true);
  };

  const handleOpenKillAllDev = () => {
    const targets = servers.filter((s) => s.isDevServer);
    if (targets.length === 0) return;
    setModalTargets(targets);
    setIsModalOpen(true);
  };

  const handleConfirmTermination = async (signal: 'SIGTERM' | 'SIGKILL') => {
    setIsTerminating(true);
    try {
      const pids = modalTargets.map((t) => t.pid);
      const ports = modalTargets.map((t) => t.port);
      const res = await onKillProcesses(pids, ports, signal);

      if (res) {
        setResultBanner({
          message: `Successfully released ${res.portsReleasedCount} of ${modalTargets.length} listening port(s).`,
          success: res.allSuccessful,
        });
        setSelectedPids(new Set());
      }
    } finally {
      setIsTerminating(false);
      setIsModalOpen(false);
    }
  };

  const getServerBadgeColor = (type: string, isDev: boolean) => {
    if (isDev) return 'badge-ai';
    if (type === 'PostgreSQL' || type === 'MySQL' || type === 'Redis') return 'badge-connected';
    return 'badge-neutral';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Metrics Header Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Active Listening Servers</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
            {servers.length} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>ports</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '3px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Development Servers (Vite, Next, Python)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '4px' }}>
            {devServersCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>servers</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Background Daemons & DBs</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '4px' }}>
            {infraCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>services</span>
          </div>
        </div>
      </div>

      {/* Result Callout Banner */}
      {resultBanner && (
        <div
          className="glass-panel"
          style={{
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: resultBanner.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: resultBanner.success ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} color={resultBanner.success ? '#34d399' : '#fbbf24'} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{resultBanner.message}</span>
          </div>
          <button className="action-btn" onClick={() => setResultBanner(null)} style={{ padding: '2px 6px', fontSize: '0.75rem' }}>
            Dismiss
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="glass-panel toolbar-section" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Filter Badges */}
          <button
            className={`badge ${!devOnlyFilter ? 'badge-connected' : 'badge-neutral'}`}
            onClick={() => setDevOnlyFilter(false)}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            All Servers ({servers.length})
          </button>
          <button
            className={`badge ${devOnlyFilter ? 'badge-connected' : 'badge-neutral'}`}
            onClick={() => setDevOnlyFilter(true)}
            style={{ cursor: 'pointer', border: 'none' }}
          >
            ⚡ Dev Servers Only ({devServersCount})
          </button>

          {/* Quick Selection Buttons */}
          <button
            className="action-btn"
            onClick={selectAllDevServers}
            style={{ fontSize: '0.75rem', gap: '4px' }}
            title="Select all identified development servers"
          >
            <CheckSquare size={13} /> Select Dev Servers
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          className="search-input"
          style={{ width: '260px' }}
          placeholder="Filter by port, PID, process, framework..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedPids.size > 0 && (
            <button
              className="action-btn active"
              onClick={handleOpenKillSelected}
              style={{
                fontSize: '0.78rem',
                gap: '6px',
                background: 'var(--accent-rose)',
                borderColor: 'var(--accent-rose)',
              }}
            >
              <Trash2 size={13} />
              <span>Kill Selected ({selectedPids.size})</span>
            </button>
          )}

          {devServersCount > 0 && (
            <button
              className="action-btn"
              onClick={handleOpenKillAllDev}
              style={{
                fontSize: '0.78rem',
                gap: '6px',
                color: '#fb7185',
                borderColor: 'rgba(244, 63, 94, 0.3)',
              }}
              title="Kill all detected background development servers"
            >
              <Zap size={13} />
              <span>Kill All Dev Servers ({devServersCount})</span>
            </button>
          )}

          <button
            className="action-btn"
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh local listening servers"
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Local Servers Table */}
      <div className="glass-panel table-wrapper">
        {/* Top Summary Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(255, 255, 255, 0.015)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              className="action-btn"
              onClick={toggleSelectAllFiltered}
              style={{ padding: '2px 6px', fontSize: '0.75rem', gap: '4px' }}
            >
              {selectedPids.size === filteredServers.length && filteredServers.length > 0 ? (
                <CheckSquare size={13} color="var(--accent-cyan)" />
              ) : (
                <Square size={13} />
              )}
              <span>{selectedPids.size > 0 ? `${selectedPids.size} selected` : 'Select All'}</span>
            </button>

            <span
              className="badge badge-connected"
              style={{ fontWeight: 700, padding: '2px 8px', fontSize: '0.74rem' }}
            >
              Page {currentPage} of {Math.max(1, Math.ceil(filteredServers.length / pageSize))}
            </span>

            <span style={{ color: 'var(--text-secondary)' }}>
              Showing <strong>{filteredServers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredServers.length)}</strong> of <strong>{filteredServers.length}</strong> listening servers
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Page Size:</span>
            <select
              className="search-input"
              style={{ padding: '2px 6px', fontSize: '0.76rem', borderRadius: '4px', cursor: 'pointer' }}
              value={pageSize > 1000 ? 999999 : pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={999999}>All</option>
            </select>
          </div>
        </div>

        <table className="connections-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Port</th>
              <th>Local Address</th>
              <th>Process</th>
              <th>PID / PPID</th>
              <th>Detected Server Type</th>
              <th>Command Line</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedServers.length > 0 ? (
              paginatedServers.map((s) => {
                const isSelected = selectedPids.has(s.pid);

                return (
                  <tr
                    key={`${s.pid}-${s.port}`}
                    style={{
                      background: s.isSelf
                        ? 'rgba(16, 185, 129, 0.09)'
                        : isSelected
                        ? 'rgba(0, 240, 255, 0.06)'
                        : undefined,
                      borderLeft: s.isSelf ? '3px solid #10b981' : undefined,
                    }}
                  >
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectPid(s.pid)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <span
                        className="port-badge"
                        style={{
                          fontWeight: 700,
                          background: s.isSelf ? 'rgba(16, 185, 129, 0.2)' : undefined,
                          color: s.isSelf ? '#34d399' : undefined,
                          borderColor: s.isSelf ? '#10b981' : undefined,
                        }}
                      >
                        {s.port}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {s.localAddress}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Server size={14} color={s.isSelf ? '#34d399' : 'var(--accent-cyan)'} />
                        <strong style={{ color: s.isSelf ? '#34d399' : 'var(--text-primary)' }}>{s.processName}</strong>
                        {s.isSelf && (
                          <span
                            className="badge badge-connected"
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 6px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              borderColor: 'rgba(16, 185, 129, 0.4)',
                              fontWeight: 700,
                            }}
                          >
                            🛡️ AgentLens ({s.port === 43121 ? 'Backend' : 'Frontend'})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        PID {s.pid} {s.ppid ? <span style={{ color: 'rgba(255,255,255,0.3)' }}>(PPID: {s.ppid})</span> : ''}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          className={`badge ${s.isSelf ? 'badge-connected' : getServerBadgeColor(s.serverType, s.isDevServer)}`}
                          style={{ fontSize: '0.72rem', padding: '2px 8px', fontWeight: 600 }}
                        >
                          {s.serverType}
                        </span>
                        {s.isDevServer && !s.isSelf && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              background: 'rgba(0, 240, 255, 0.1)',
                              color: 'var(--accent-cyan)',
                            }}
                          >
                            DEV
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ maxWidth: '320px' }}>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={s.commandLine || s.detectionReason}
                      >
                        {s.commandLine || s.detectionReason}
                      </div>
                    </td>
                    <td>
                      <button
                        className="action-btn"
                        onClick={() => handleOpenKillSingle(s)}
                        style={{
                          padding: '3px 10px',
                          fontSize: '0.75rem',
                          gap: '4px',
                          color: '#fb7185',
                          background: 'rgba(244, 63, 94, 0.08)',
                          borderColor: 'rgba(244, 63, 94, 0.25)',
                        }}
                        title={`Kill process ${s.processName} on port ${s.port}`}
                      >
                        <Trash2 size={12} />
                        <span>Kill</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : isLoading ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state-box">
                    <RefreshCw size={30} className="spin" style={{ color: 'var(--accent-cyan)', opacity: 0.8, marginBottom: '8px' }} />
                    <div className="empty-title">
                      Discovering Local Listening Servers...
                    </div>
                    <p className="empty-desc">
                      Scanning local loopback interfaces and active listening sockets...
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state-box">
                    <div className="empty-icon-wrap">
                      <Server size={30} />
                    </div>
                    <div className="empty-title">
                      {searchQuery ? 'No Listening Servers Match Query' : 'No Local Listening Servers Found'}
                    </div>
                    <p className="empty-desc">
                      {searchQuery
                        ? `No servers matched "${searchQuery}". Clear your search query.`
                        : 'No processes are currently listening on local ports.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Bottom Pagination */}
        {filteredServers.length > 0 && (
          <Pagination
            totalItems={filteredServers.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="servers"
          />
        )}
      </div>

      {/* Kill Confirmation Modal */}
      <KillServersModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targets={modalTargets}
        onConfirm={handleConfirmTermination}
        isTerminating={isTerminating}
      />
    </div>
  );
};
