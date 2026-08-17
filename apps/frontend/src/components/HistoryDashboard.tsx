import React, { useState } from 'react';
import {
  HistorySummary,
  TrafficTimelineBucket,
  HistoryStatus,
  HistoryTimeRange,
  TopRemoteIpStat,
  NetworkConnection,
} from '@network-monitor/shared';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Globe,
  Bot,
  Layers,
  ChevronDown,
  ChevronRight,
  Database,
  Trash2,
  Play,
  Pause,
  Clock,
} from 'lucide-react';
import { TrafficChart } from './TrafficChart.js';
import { formatBytes, formatBytesPerSec } from '../utils/formatters.js';

export interface HistoryDashboardProps {
  summary: HistorySummary | null;
  timeline: TrafficTimelineBucket[];
  status: HistoryStatus | null;
  topIps: TopRemoteIpStat[];
  timeRange: HistoryTimeRange;
  onTimeRangeChange: (range: HistoryTimeRange) => void;
  onToggleRecording: (enabled: boolean) => Promise<boolean>;
  onClearHistory: (olderThanHours?: number) => Promise<boolean>;
  liveConnections: NetworkConnection[];
  isLoading?: boolean;
}

export const HistoryDashboard: React.FC<HistoryDashboardProps> = ({
  summary,
  timeline,
  status,
  topIps,
  timeRange,
  onTimeRangeChange,
  onToggleRecording,
  onClearHistory,
  liveConnections,
}) => {
  const [subTab, setSubTab] = useState<'PROCESS_GROUPS' | 'AI_AGENTS' | 'TOP_IPS' | 'LIVE_GROUPS'>('PROCESS_GROUPS');
  const [expandedPids, setExpandedPids] = useState<Set<number>>(new Set());

  const toggleExpand = (pid: number) => {
    setExpandedPids((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all historical network records? Current firewall rules and live monitoring will NOT be affected.')) {
      return;
    }
    await onClearHistory();
  };

  // Group live connections by process
  const processGroups = React.useMemo(() => {
    const map = new Map<number, {
      processName: string;
      pid: number;
      isAiAgent: boolean;
      aiAgentName?: string;
      connections: NetworkConnection[];
      trafficIn: number;
      trafficOut: number;
    }>();

    for (const conn of liveConnections) {
      if (!map.has(conn.pid)) {
        map.set(conn.pid, {
          processName: conn.processName,
          pid: conn.pid,
          isAiAgent: !!conn.isAiAgent,
          aiAgentName: conn.aiAgentName,
          connections: [],
          trafficIn: conn.traffic?.bytesInPerSecond || 0,
          trafficOut: conn.traffic?.bytesOutPerSecond || 0,
        });
      }
      map.get(conn.pid)!.connections.push(conn);
    }

    return Array.from(map.values()).sort((a, b) => b.connections.length - a.connections.length);
  }, [liveConnections]);

  const aiGroups = processGroups.filter((g) => g.isAiAgent);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Toolbar: Time Range, Storage Status & Action Controls */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Time Range Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={13} /> Range:
          </span>
          {(['5m', '30m', '1h', '6h', '24h', '7d'] as HistoryTimeRange[]).map((r) => (
            <button
              key={r}
              className={`action-btn ${timeRange === r ? 'active' : ''}`}
              onClick={() => onTimeRangeChange(r)}
              style={{
                fontSize: '0.76rem',
                padding: '4px 10px',
                background: timeRange === r ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                borderColor: timeRange === r ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                color: timeRange === r ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Storage Status & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Database size={14} color="var(--accent-blue)" />
            <span>SQLite: <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>{status?.databaseSizeFormatted || '0 B'}</strong></span>
            <span style={{ color: 'var(--text-muted)' }}>({status?.retentionDays || 7}d retention)</span>
          </div>

          <button
            className="action-btn"
            onClick={() => status && onToggleRecording(!status.isRecording)}
            style={{ fontSize: '0.76rem', padding: '4px 10px', gap: '4px' }}
            title={status?.isRecording ? 'Pause History Recording' : 'Resume History Recording'}
          >
            {status?.isRecording ? <Pause size={12} color="#fbbf24" /> : <Play size={12} color="#34d399" />}
            <span>{status?.isRecording ? 'Recording' : 'Paused'}</span>
          </button>

          <button
            className="action-btn"
            onClick={handleClear}
            style={{ fontSize: '0.76rem', padding: '4px 10px', gap: '4px', color: 'var(--accent-rose)' }}
            title="Clear all historical records"
          >
            <Trash2 size={12} />
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Downloaded</span>
            <div className="metric-icon" style={{ color: 'var(--accent-emerald)' }}><ArrowDown size={16} /></div>
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--accent-emerald)' }}>
            {formatBytes(summary?.totalDownloaded || 0)}
          </div>
          <div className="metric-footnote">Avg: {formatBytesPerSec(summary?.averageDownload || 0)}</div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Uploaded</span>
            <div className="metric-icon" style={{ color: 'var(--accent-cyan)' }}><ArrowUp size={16} /></div>
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--accent-cyan)' }}>
            {formatBytes(summary?.totalUploaded || 0)}
          </div>
          <div className="metric-footnote">Avg: {formatBytesPerSec(summary?.averageUpload || 0)}</div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span className="metric-title">Peak Throughput</span>
            <div className="metric-icon" style={{ color: 'var(--accent-purple)' }}><Activity size={16} /></div>
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--accent-purple)' }}>
            {formatBytesPerSec(Math.max(summary?.peakDownload || 0, summary?.peakUpload || 0))}
          </div>
          <div className="metric-footnote">↓ {formatBytesPerSec(summary?.peakDownload || 0)} &bull; ↑ {formatBytesPerSec(summary?.peakUpload || 0)}</div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span className="metric-title">Unique Remote IPs</span>
            <div className="metric-icon" style={{ color: 'var(--accent-amber)' }}><Globe size={16} /></div>
          </div>
          <div className="metric-value font-mono" style={{ color: 'var(--accent-amber)' }}>
            {summary?.uniqueRemoteIps || 0}
          </div>
          <div className="metric-footnote">{summary?.totalRecordedConnections || 0} socket observations</div>
        </div>
      </div>

      {/* Traffic Throughput Timeline Chart */}
      <div className="glass-panel" style={{ padding: '18px 20px' }}>
        <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={16} color="var(--accent-emerald)" /> Historical Throughput Timeline
        </h4>
        <TrafficChart timeline={timeline} height={160} />
      </div>

      {/* Grouping & Analytics Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`badge ${subTab === 'PROCESS_GROUPS' ? 'badge-connected' : 'badge-neutral'}`}
          onClick={() => setSubTab('PROCESS_GROUPS')}
          style={{ cursor: 'pointer', fontSize: '0.82rem', padding: '6px 12px', border: 'none' }}
        >
          <Layers size={13} /> Group by Process ({processGroups.length})
        </button>
        <button
          className={`badge ${subTab === 'AI_AGENTS' ? 'badge-connected' : 'badge-neutral'}`}
          onClick={() => setSubTab('AI_AGENTS')}
          style={{ cursor: 'pointer', fontSize: '0.82rem', padding: '6px 12px', border: 'none' }}
        >
          <Bot size={13} /> AI Agents ({aiGroups.length})
        </button>
        <button
          className={`badge ${subTab === 'TOP_IPS' ? 'badge-connected' : 'badge-neutral'}`}
          onClick={() => setSubTab('TOP_IPS')}
          style={{ cursor: 'pointer', fontSize: '0.82rem', padding: '6px 12px', border: 'none' }}
        >
          <Globe size={13} /> Top Remote IPs ({topIps.length})
        </button>
      </div>

      {/* Sub-Tab 1: Group by Process */}
      {subTab === 'PROCESS_GROUPS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {processGroups.map((group) => {
            const isExpanded = expandedPids.has(group.pid);
            return (
              <div key={group.pid} className="glass-panel" style={{ padding: '14px 18px' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleExpand(group.pid)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button className="action-btn" style={{ padding: '2px', background: 'transparent', border: 'none' }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '0.95rem' }}>{group.processName}</strong>
                        <span className="badge badge-neutral font-mono" style={{ fontSize: '0.72rem' }}>PID: {group.pid}</span>
                        {group.isAiAgent && (
                          <span className="badge badge-connected" style={{ fontSize: '0.7rem' }}>
                            <Bot size={11} /> {group.aiAgentName || 'AI Agent'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {group.connections.length} Active Sockets &bull; {new Set(group.connections.map((c) => c.remoteAddress).filter(Boolean)).size} Unique Remote IPs
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="font-mono" style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                      <div style={{ color: group.trafficIn > 0 ? '#34d399' : 'var(--text-muted)' }}>
                        ↓ {formatBytesPerSec(group.trafficIn)}
                      </div>
                      <div style={{ color: group.trafficOut > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                        ↑ {formatBytesPerSec(group.trafficOut)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible Sockets List */}
                {isExpanded && (
                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <table className="connections-table" style={{ fontSize: '0.78rem' }}>
                      <thead>
                        <tr>
                          <th>Protocol</th>
                          <th>Local Port</th>
                          <th>Remote Endpoint</th>
                          <th>State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.connections.map((c) => (
                          <tr key={c.id}>
                            <td><span className="pill-tag">{c.protocol}</span></td>
                            <td className="font-mono">{c.localPort || '*'}</td>
                            <td className="font-mono" style={{ color: c.remoteAddress ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {c.remoteAddress ? `${c.remoteAddress}:${c.remotePort || '*'}` : '—'}
                            </td>
                            <td><span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{c.state}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-Tab 2: AI Agents Group */}
      {subTab === 'AI_AGENTS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {aiGroups.length > 0 ? (
            aiGroups.map((group) => (
              <div key={group.pid} className="glass-panel" style={{ padding: '16px 20px', borderLeft: '3px solid var(--accent-emerald)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={18} color="#34d399" />
                    <strong style={{ fontSize: '1rem' }}>{group.aiAgentName || group.processName}</strong>
                    <span className="badge badge-neutral font-mono">PID {group.pid}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: '0.82rem', display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#34d399' }}>↓ {formatBytesPerSec(group.trafficIn)}</span>
                    <span style={{ color: '#38bdf8' }}>↑ {formatBytesPerSec(group.trafficOut)}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Active Endpoints Contacted:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {Array.from(new Set(group.connections.map((c) => c.remoteAddress).filter(Boolean))).map((ip) => (
                    <span key={ip} className="pill-tag font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                      {ip}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No active AI Agent processes (Ollama, LM Studio, Claude, ChatGPT, etc.) currently detected.
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Top Remote IPs */}
      {subTab === 'TOP_IPS' && (
        <div className="glass-panel table-wrapper">
          <table className="connections-table">
            <thead>
              <tr>
                <th>Remote IP Address</th>
                <th>Observed Connections</th>
                <th>Associated Processes</th>
                <th>First Seen</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {topIps.length > 0 ? (
                topIps.map((ip) => (
                  <tr key={ip.remoteAddress}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                      {ip.remoteAddress}
                    </td>
                    <td className="font-mono">{ip.connectionsCount} observations</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {ip.associatedProcesses.map((p) => (
                          <span key={p} className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(ip.firstSeen).toLocaleTimeString()}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {new Date(ip.lastSeen).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No remote IP observations recorded in this time range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
