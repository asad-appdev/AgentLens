import React, { useState, useEffect } from 'react';
import { ProcessTraffic } from '@network-monitor/shared';
import { formatBytesPerSec, formatBytes } from '../utils/formatters.js';
import { ArrowDown, ArrowUp, Bot, Activity, X } from 'lucide-react';
import { TrafficFilter, TrafficSortField, SortDirection } from '../hooks/useNetworkTraffic.js';
import { Pagination } from './Pagination.js';

export interface ProcessTrafficPanelProps {
  processes: ProcessTraffic[];
  filter: TrafficFilter;
  setFilter: (f: TrafficFilter) => void;
  sortField: TrafficSortField;
  sortDirection: SortDirection;
  onSort: (field: TrafficSortField) => void;
  selectedProcess: ProcessTraffic | null;
  onSelectProcess: (p: ProcessTraffic | null) => void;
}

export const ProcessTrafficPanel: React.FC<ProcessTrafficPanelProps> = ({
  processes,
  filter,
  setFilter,
  sortField,
  sortDirection,
  onSort,
  selectedProcess,
  onSelectProcess,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedProcesses = processes.slice(startIndex, startIndex + pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Filter and Control Bar */}
      <div className="glass-panel toolbar-section" style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filter:</span>
          {(['ALL', 'ACTIVE', 'IDLE', 'AI_AGENTS'] as TrafficFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`badge ${filter === f ? 'badge-connected' : 'badge-neutral'}`}
              style={{ cursor: 'pointer', border: 'none' }}
            >
              {f === 'AI_AGENTS' ? '🤖 AI Agents' : f}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Total <strong>{processes.length}</strong> processes
        </div>
      </div>

      {/* Process Traffic Table */}
      <div className="glass-panel table-wrapper">
        <table className="connections-table">
          <thead>
            <tr>
              <th onClick={() => onSort('process')} style={{ cursor: 'pointer' }}>
                Process {sortField === 'process' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => onSort('pid')} style={{ cursor: 'pointer' }}>
                PID {sortField === 'pid' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => onSort('download')} style={{ cursor: 'pointer' }}>
                Download (In) {sortField === 'download' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => onSort('upload')} style={{ cursor: 'pointer' }}>
                Upload (Out) {sortField === 'upload' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => onSort('total')} style={{ cursor: 'pointer' }}>
                Total Rate {sortField === 'total' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => onSort('activity')} style={{ cursor: 'pointer' }}>
                Activity {sortField === 'activity' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th>Measurement Scope</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProcesses.length > 0 ? (
              paginatedProcesses.map((p) => (
                <tr
                  key={p.pid}
                  onClick={() => onSelectProcess(p)}
                  style={{
                    cursor: 'pointer',
                    background: selectedProcess?.pid === p.pid ? 'rgba(0, 240, 255, 0.05)' : undefined,
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{p.processName}</strong>
                      {p.isAiAgent && (
                        <span
                          className="badge badge-connected"
                          style={{ fontSize: '0.7rem', padding: '1px 6px' }}
                        >
                          <Bot size={12} /> {p.aiAgentName || 'AI Agent'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {p.pid}
                    </span>
                  </td>
                  <td>
                    <div className="font-mono" style={{ color: p.bytesInPerSecond > 0 ? '#4ade80' : 'var(--text-muted)' }}>
                      <ArrowDown size={11} style={{ display: 'inline', marginRight: '4px' }} />
                      {formatBytesPerSec(p.bytesInPerSecond)}
                    </div>
                  </td>
                  <td>
                    <div className="font-mono" style={{ color: p.bytesOutPerSecond > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                      <ArrowUp size={11} style={{ display: 'inline', marginRight: '4px' }} />
                      {formatBytesPerSec(p.bytesOutPerSecond)}
                    </div>
                  </td>
                  <td>
                    <div className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatBytesPerSec(p.totalBytesPerSecond)}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${p.activity === 'ACTIVE' ? 'badge-connected' : 'badge-neutral'}`}
                      style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                    >
                      {p.activity === 'ACTIVE' && <span className="status-dot online" style={{ width: '6px', height: '6px' }} />}
                      {p.activity}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Process (nettop)
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state-box">
                    <div className="empty-icon-wrap">
                      <Activity size={30} />
                    </div>
                    <div className="empty-title">No Network Traffic Detected</div>
                    <p className="empty-desc">
                      nettop is actively polling process network rates on macOS.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {processes.length > 0 && (
          <Pagination
            totalItems={processes.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="processes"
          />
        )}
      </div>

      {/* Process Detail Inspector Overlay */}
      {selectedProcess && (
        <div className="glass-panel" style={{ padding: '20px', border: '1px solid var(--accent-cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {selectedProcess.processName} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>(PID: {selectedProcess.pid})</span>
              </h3>
              {selectedProcess.isAiAgent && (
                <span className="badge badge-connected" style={{ fontSize: '0.75rem' }}>
                  <Bot size={14} /> AI Runtime: {selectedProcess.aiAgentName}
                </span>
              )}
            </div>
            <button
              className="action-btn"
              onClick={() => onSelectProcess(null)}
              style={{ padding: '4px 8px' }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Download Rate (In)</div>
              <div className="font-mono" style={{ fontSize: '1.2rem', color: '#34d399', fontWeight: 700 }}>
                {formatBytesPerSec(selectedProcess.bytesInPerSecond)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cumulative: {formatBytes(selectedProcess.bytesIn)}</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Upload Rate (Out)</div>
              <div className="font-mono" style={{ fontSize: '1.2rem', color: '#38bdf8', fontWeight: 700 }}>
                {formatBytesPerSec(selectedProcess.bytesOutPerSecond)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cumulative: {formatBytes(selectedProcess.bytesOut)}</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Live Rate</div>
              <div className="font-mono" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {formatBytesPerSec(selectedProcess.totalBytesPerSecond)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Status: {selectedProcess.activity}</div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Measurement Scope</div>
              <div className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-indigo)', fontWeight: 700 }}>
                Process-Level
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>From macOS nettop</div>
            </div>
          </div>

          {/* 60-Second Trendline Graph */}
          {selectedProcess.history && selectedProcess.history.length > 1 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Traffic History (Rolling 60 Seconds)
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px', height: '90px' }}>
                <svg width="100%" height="70" viewBox="0 0 500 70" preserveAspectRatio="none">
                  {(() => {
                    const history = selectedProcess.history || [];
                    const maxVal = Math.max(1000, ...history.map((h) => h.bytesInPerSecond + h.bytesOutPerSecond));
                    const points = history.map((h, i) => {
                      const x = (i / (Math.max(1, history.length - 1))) * 500;
                      const y = 65 - ((h.bytesInPerSecond + h.bytesOutPerSecond) / maxVal) * 55;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="var(--accent-cyan)"
                          strokeWidth="2.5"
                          points={points}
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
