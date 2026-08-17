import React, { useState, useEffect, useMemo } from 'react';
import { NetworkConnection } from '@network-monitor/shared';
import {
  Layers,
  Radio,
  ArrowDown,
  ArrowUp,

  Bot,
  ShieldAlert,
  Shield,
  Star,
  MoreHorizontal,
  Copy,
  Search,
  ChevronDown,
  ChevronRight,
  Cpu,
  Globe,
  Activity,
  Filter,
  FolderTree,
} from 'lucide-react';
import { Pagination } from './Pagination.js';
import { formatBytesPerSec } from '../utils/formatters.js';

export interface ConnectionTableProps {
  connections: NetworkConnection[];
  filterQuery: string;
  isLoading?: boolean;
  isCompact?: boolean;
  isIpBlocked?: (ip: string) => boolean;
  isFavorite?: (pid: number, name: string) => boolean;
  onInitiateBlock?: (conn: NetworkConnection) => void;
  onInspectProcess?: (pid: number) => void;
  onInspectRemoteIp?: (ip: string) => void;
}

export type ConnectionStateFilter =
  | 'ALL'
  | 'LISTEN'
  | 'ESTABLISHED'
  | 'CLOSE_WAIT'
  | 'TIME_WAIT'
  | 'SYN_SENT'
  | 'UNCONNECTED'
  | 'AI_ONLY';

export type GroupByOption = 'NONE' | 'PROCESS' | 'AGENT' | 'STATE' | 'REMOTE_HOST' | 'LOCAL_PORT';

export const ConnectionTable: React.FC<ConnectionTableProps> = ({
  connections,
  filterQuery,
  isLoading = false,
  isCompact = false,
  isIpBlocked,
  isFavorite,
  onInitiateBlock,
  onInspectProcess,
  onInspectRemoteIp,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<ConnectionStateFilter>('ALL');
  const [groupBy, setGroupBy] = useState<GroupByOption>('NONE');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // 1. Calculate live state counts across all connections
  const stateCounts = useMemo(() => {
    const counts = {
      ALL: connections.length,
      LISTEN: 0,
      ESTABLISHED: 0,
      CLOSE_WAIT: 0,
      TIME_WAIT: 0,
      SYN_SENT: 0,
      UNCONNECTED: 0,
      AI_ONLY: 0,
    };

    connections.forEach((c) => {
      const s = (c.state || '').toUpperCase();
      if (s === 'LISTEN') counts.LISTEN++;
      else if (s === 'ESTABLISHED') counts.ESTABLISHED++;
      else if (s === 'CLOSE_WAIT') counts.CLOSE_WAIT++;
      else if (s === 'TIME_WAIT') counts.TIME_WAIT++;
      else if (s === 'SYN_SENT' || s === 'SYN_RECEIVED') counts.SYN_SENT++;
      else if (s === 'UNCONNECTED') counts.UNCONNECTED++;

      if (c.isAiAgent) counts.AI_ONLY++;
    });

    return counts;
  }, [connections]);

  // 2. Filter connections by query and selected state
  const filtered = useMemo(() => {
    return connections.filter((conn) => {
      // State filter check
      if (stateFilter === 'AI_ONLY') {
        if (!conn.isAiAgent) return false;
      } else if (stateFilter !== 'ALL') {
        const s = (conn.state || '').toUpperCase();
        if (stateFilter === 'SYN_SENT') {
          if (s !== 'SYN_SENT' && s !== 'SYN_RECEIVED') return false;
        } else if (s !== stateFilter) {
          return false;
        }
      }

      // Text search filter check
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      return (
        conn.processName?.toLowerCase().includes(q) ||
        conn.pid.toString().includes(q) ||
        conn.protocol.toLowerCase().includes(q) ||
        conn.state.toLowerCase().includes(q) ||
        (conn.localPort !== null && conn.localPort.toString().includes(q)) ||
        conn.localAddress.toLowerCase().includes(q) ||
        (conn.remoteAddress && conn.remoteAddress.toLowerCase().includes(q)) ||
        (conn.remotePort !== null && conn.remotePort.toString().includes(q)) ||
        (conn.aiAgentName && conn.aiAgentName.toLowerCase().includes(q))
      );
    });
  }, [connections, stateFilter, filterQuery]);

  // Reset to first page when filtering changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterQuery, stateFilter, groupBy]);

  // 3. Grouping logic
  interface ConnectionGroup {
    key: string;
    label: string;
    icon: React.ReactNode;
    items: NetworkConnection[];
    totalBytesIn: number;
    totalBytesOut: number;
  }

  const groupedData: ConnectionGroup[] = useMemo(() => {
    if (groupBy === 'NONE') return [];

    const groupMap = new Map<string, ConnectionGroup>();

    filtered.forEach((conn) => {
      let key = 'Other';
      let label = 'Other';
      let icon = <Layers size={14} />;

      if (groupBy === 'PROCESS') {
        key = `${conn.processName || 'Unknown'}-${conn.pid}`;
        label = `${conn.processName || 'Unknown'} (PID ${conn.pid})`;
        icon = <Cpu size={14} color="#38bdf8" />;
      } else if (groupBy === 'AGENT') {
        if (conn.isAiAgent && conn.aiAgentName) {
          key = conn.aiAgentName;
          label = `🤖 ${conn.aiAgentName}`;
          icon = <Bot size={14} color="#00f0ff" />;
        } else {
          key = '__system__';
          label = 'Standard System Processes';
          icon = <Cpu size={14} color="#94a3b8" />;
        }
      } else if (groupBy === 'STATE') {
        key = conn.state || 'UNKNOWN';
        label = conn.state || 'UNKNOWN';
        icon = <Activity size={14} color="#34d399" />;
      } else if (groupBy === 'REMOTE_HOST') {
        key = conn.remoteAddress || 'Local / Loopback';
        label = conn.remoteAddress ? `Remote: ${conn.remoteAddress}` : 'Local Listening / Loopback';
        icon = <Globe size={14} color="#c084fc" />;
      } else if (groupBy === 'LOCAL_PORT') {
        key = conn.localPort !== null ? conn.localPort.toString() : 'None';
        label = conn.localPort !== null ? `Port ${conn.localPort}` : 'No Bound Port';
        icon = <Radio size={14} color="#fbbf24" />;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          label,
          icon,
          items: [],
          totalBytesIn: 0,
          totalBytesOut: 0,
        });
      }

      const grp = groupMap.get(key)!;
      grp.items.push(conn);
      if (conn.traffic) {
        grp.totalBytesIn += conn.traffic.bytesInPerSecond;
        grp.totalBytesOut += conn.traffic.bytesOutPerSecond;
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filtered, groupBy]);

  // Paginated flat slice
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedConnections = filtered.slice(startIndex, startIndex + pageSize);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const expandAllGroups = () => {
    setCollapsedGroups({});
  };

  const collapseAllGroups = () => {
    const allCollapsed: Record<string, boolean> = {};
    groupedData.forEach((g) => {
      allCollapsed[g.key] = true;
    });
    setCollapsedGroups(allCollapsed);
  };

  const getStateBadgeStyle = (state: string): React.CSSProperties => {
    switch (state) {
      case 'LISTEN':
        return { background: 'rgba(0, 240, 255, 0.12)', color: '#00f0ff', borderColor: 'rgba(0, 240, 255, 0.3)' };
      case 'ESTABLISHED':
        return { background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' };
      case 'CLOSE_WAIT':
      case 'TIME_WAIT':
      case 'SYN_SENT':
      case 'SYN_RECEIVED':
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.3)' };
      case 'UNCONNECTED':
        return { background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.3)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', borderColor: 'rgba(255, 255, 255, 0.1)' };
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  // Render a single connection row
  const renderConnectionRow = (conn: NetworkConnection) => {
    const rowKey = `${conn.pid}-${conn.protocol}-${conn.localPort || 0}-${conn.remoteAddress || 'none'}-${conn.remotePort || 0}-${conn.fd || 0}`;
    const remoteDisplay = conn.remoteAddress
      ? `${conn.remoteAddress}:${conn.remotePort !== null ? conn.remotePort : '*'}`
      : '—';

    const hasTraffic = !!conn.traffic;
    const isActive = conn.traffic?.activity === 'ACTIVE';
    const isRemoteBlocked = conn.remoteAddress && isIpBlocked ? isIpBlocked(conn.remoteAddress) : false;
    const canBlock = !!conn.remoteAddress && conn.remoteAddress !== '*' && conn.remoteAddress !== '127.0.0.1' && conn.remoteAddress !== '::1';
    const isFav = isFavorite && conn.processName ? isFavorite(conn.pid, conn.processName) : false;
    const isSelf = conn.isSelf || conn.localPort === 43121 || conn.localPort === 5174;
    const isMenuOpen = openMenuKey === rowKey;

    return (
      <tr
        key={rowKey}
        className={`${isActive ? 'row-active-traffic' : ''} ${conn.isAiAgent ? 'row-ai-agent' : ''}`}
        style={{
          background: isSelf ? 'rgba(16, 185, 129, 0.06)' : undefined,
          borderLeft: isSelf ? '3px solid #10b981' : undefined,
        }}
      >
        {/* Local Port */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <span
            className="port-badge"
            style={{
              background: isSelf ? 'rgba(16, 185, 129, 0.2)' : undefined,
              color: isSelf ? '#34d399' : undefined,
              borderColor: isSelf ? '#10b981' : undefined,
              fontWeight: 700,
            }}
          >
            {conn.localPort !== null ? conn.localPort : '*'}
          </span>
        </td>

        {/* Process Name */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {isFav && (
              <span title="Favorite Process" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Star size={12} fill="#fbbf24" color="#fbbf24" />
              </span>
            )}
            <span
              className="process-name"
              onClick={() => onInspectProcess && onInspectProcess(conn.pid)}
              style={{
                cursor: 'pointer',
                textDecoration: 'underline dotted',
                color: isSelf ? '#34d399' : undefined,
                fontWeight: isSelf ? 700 : undefined,
              }}
              title="Click to inspect process relationship & tree"
            >
              {conn.processName || 'Unknown'}
            </span>
            {isSelf && (
              <span
                className="badge badge-connected"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '1px 6px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  borderRadius: '4px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                }}
              >
                🛡️ AgentLens ({conn.localPort === 43121 ? 'Backend' : 'Frontend'})
              </span>
            )}
          </div>
        </td>

        {/* PID */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <span
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', cursor: 'pointer' }}
            onClick={() => onInspectProcess && onInspectProcess(conn.pid)}
            title="Inspect PID"
          >
            {conn.pid}
          </span>
        </td>

        {/* Agent */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          {conn.isAiAgent ? (
            <span
              className="badge badge-ai"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 7px',
                fontSize: '0.72rem',
                fontWeight: 700,
                borderRadius: '4px',
                background: 'rgba(0, 240, 255, 0.12)',
                color: '#00f0ff',
                border: '1px solid rgba(0, 240, 255, 0.3)',
              }}
            >
              <Bot size={11} />
              <span>{conn.aiAgentName || 'AI Agent'}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>—</span>
          )}
        </td>

        {/* Protocol */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <span className="badge badge-neutral" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
            {conn.protocol}
          </span>
        </td>

        {/* Local Address */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {conn.localAddress}
          </span>
        </td>

        {/* Remote IP:Port */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          {conn.remoteAddress ? (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: isRemoteBlocked ? '#fb7185' : 'var(--accent-cyan)',
                cursor: 'pointer',
                textDecoration: isRemoteBlocked ? 'line-through' : 'underline dotted',
              }}
              onClick={() => onInspectRemoteIp && onInspectRemoteIp(conn.remoteAddress!)}
              title="Click to inspect or block remote IP"
            >
              {remoteDisplay}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
          )}
        </td>

        {/* State */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          <span
            className="badge"
            style={{
              ...getStateBadgeStyle(conn.state),
              fontSize: '0.72rem',
              padding: '2px 6px',
            }}
          >
            {conn.state}
          </span>
        </td>

        {/* Traffic */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined }}>
          {hasTraffic ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: conn.traffic!.bytesInPerSecond > 0 ? '#4ade80' : 'var(--text-muted)' }}>
                <ArrowDown size={10} style={{ display: 'inline' }} />
                {formatBytesPerSec(conn.traffic!.bytesInPerSecond)}
              </span>
              <span style={{ color: conn.traffic!.bytesOutPerSecond > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                <ArrowUp size={10} style={{ display: 'inline' }} />
                {formatBytesPerSec(conn.traffic!.bytesOutPerSecond)}
              </span>
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>0 B/s</span>
          )}
        </td>

        {/* Action */}
        <td style={{ padding: isCompact ? '4px 10px' : undefined, textAlign: 'right' }}>
          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
            {canBlock && !isRemoteBlocked && (
              <button
                className="action-btn"
                onClick={() => onInitiateBlock && onInitiateBlock(conn)}
                style={{
                  padding: '3px 7px',
                  fontSize: '0.72rem',
                  gap: '4px',
                  background: 'rgba(244, 63, 94, 0.08)',
                  borderColor: 'rgba(244, 63, 94, 0.25)',
                  color: '#fb7185',
                }}
                title="Block remote IP via firewall"
              >
                <ShieldAlert size={11} />
                <span>Block</span>
              </button>
            )}

            {isRemoteBlocked && (
              <span
                className="badge badge-disconnected"
                style={{ fontSize: '0.68rem', padding: '2px 6px', gap: '3px' }}
              >
                <Shield size={11} /> Blocked
              </span>
            )}

            <button
              className="action-btn"
              onClick={() => setOpenMenuKey(isMenuOpen ? null : rowKey)}
              style={{ padding: '3px 6px', color: 'var(--text-muted)' }}
              title="More options"
            >
              <MoreHorizontal size={13} />
            </button>

            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  zIndex: 20,
                  background: 'rgba(10, 15, 28, 0.96)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--shadow-md)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  minWidth: '150px',
                  textAlign: 'left',
                }}
                onMouseLeave={() => setOpenMenuKey(null)}
              >
                <button
                  className="action-btn"
                  onClick={() => {
                    onInspectProcess && onInspectProcess(conn.pid);
                    setOpenMenuKey(null);
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent', fontSize: '0.74rem' }}
                >
                  <Search size={12} />
                  <span>Inspect Process</span>
                </button>

                {conn.remoteAddress && (
                  <button
                    className="action-btn"
                    onClick={() => {
                      copyToClipboard(conn.remoteAddress!);
                      setOpenMenuKey(null);
                    }}
                    style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent', fontSize: '0.74rem' }}
                  >
                    <Copy size={12} />
                    <span>Copy Remote IP</span>
                  </button>
                )}

                <button
                  className="action-btn"
                  onClick={() => {
                    copyToClipboard(conn.pid.toString());
                    setOpenMenuKey(null);
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start', border: 'none', background: 'transparent', fontSize: '0.74rem' }}
                >
                  <Copy size={12} />
                  <span>Copy PID</span>
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="glass-panel table-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. Connection State Filters Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(255, 255, 255, 0.02)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <Filter size={13} />
            <span>State:</span>
          </span>

          {[
            { id: 'ALL', label: 'All', count: stateCounts.ALL },
            { id: 'LISTEN', label: 'Listen', count: stateCounts.LISTEN, color: '#00f0ff' },
            { id: 'ESTABLISHED', label: 'Established', count: stateCounts.ESTABLISHED, color: '#34d399' },
            { id: 'CLOSE_WAIT', label: 'Close Wait', count: stateCounts.CLOSE_WAIT, color: '#fbbf24' },
            { id: 'TIME_WAIT', label: 'Time Wait', count: stateCounts.TIME_WAIT, color: '#fbbf24' },
            { id: 'SYN_SENT', label: 'Syn Sent', count: stateCounts.SYN_SENT, color: '#fb923c' },
            { id: 'UNCONNECTED', label: 'Unconnected', count: stateCounts.UNCONNECTED, color: '#c084fc' },
            { id: 'AI_ONLY', label: '🤖 AI Only', count: stateCounts.AI_ONLY, color: '#00f0ff' },
          ].map((tab) => {
            const isSelected = stateFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStateFilter(tab.id as ConnectionStateFilter)}
                className={`action-btn ${isSelected ? 'active' : ''}`}
                style={{
                  fontSize: '0.74rem',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isSelected ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: isSelected ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    background: isSelected ? 'rgba(0, 240, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                    color: tab.color || 'inherit',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Group By Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <FolderTree size={13} color="var(--accent-cyan)" />
            <span>Group By:</span>
          </span>
          <select
            className="search-input"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
            style={{
              padding: '3px 8px',
              fontSize: '0.76rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: 'rgba(10, 15, 28, 0.8)',
              color: 'var(--text-primary)',
              borderColor: groupBy !== 'NONE' ? 'var(--accent-cyan)' : 'var(--border-subtle)',
            }}
          >
            <option value="NONE">None (Flat List)</option>
            <option value="PROCESS">Process (Name & PID)</option>
            <option value="AGENT">AI Agent / Assistant</option>
            <option value="STATE">Connection State</option>
            <option value="REMOTE_HOST">Remote Destination</option>
            <option value="LOCAL_PORT">Local Port</option>
          </select>

          {groupBy !== 'NONE' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="action-btn"
                onClick={expandAllGroups}
                style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                title="Expand all groups"
              >
                Expand All
              </button>
              <button
                className="action-btn"
                onClick={collapseAllGroups}
                style={{ fontSize: '0.7rem', padding: '3px 6px' }}
                title="Collapse all groups"
              >
                Collapse
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Summary & Page Size Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(255, 255, 255, 0.01)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge badge-connected"
            style={{ fontWeight: 700, padding: '2px 8px', fontSize: '0.74rem' }}
          >
            {groupBy !== 'NONE'
              ? `${groupedData.length} Groups • ${filtered.length} Connections`
              : `Page ${currentPage} of ${Math.max(1, Math.ceil(filtered.length / (pageSize > 1000 ? Math.max(1, filtered.length) : pageSize)))}`}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Showing <strong>{filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> connections
            {stateFilter !== 'ALL' && ` (filtered: ${stateFilter})`}
          </span>
        </div>

        {groupBy === 'NONE' && (
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
        )}
      </div>

      {/* 3. Table Rendering (Grouped or Flat) */}
      <table className="connections-table">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Local Port</th>
            <th>Process</th>
            <th style={{ width: 85 }}>PID</th>
            <th style={{ width: 140 }}>Agent</th>
            <th style={{ width: 80 }}>Protocol</th>
            <th>Local Address</th>
            <th>Remote IP:Port</th>
            <th style={{ width: 110 }}>State</th>
            <th style={{ width: 130 }}>Traffic</th>
            <th style={{ width: 100, textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={10}>
                <div className="empty-state-box">
                  <div className="empty-icon-wrap" style={{ animation: 'spin 1.5s linear infinite' }}>
                    <Radio size={28} />
                  </div>
                  <div className="empty-title">Scanning Active Network Connections...</div>
                  <p className="empty-desc">Executing safe local network socket discovery.</p>
                </div>
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={10}>
                <div className="empty-state-box">
                  <div className="empty-icon-wrap">
                    <Layers size={30} />
                  </div>
                  <div className="empty-title">No Connections Match Current Filters</div>
                  <p className="empty-desc">
                    {stateFilter !== 'ALL'
                      ? `No active connections in "${stateFilter}" state found.`
                      : filterQuery
                      ? `No active connections matched "${filterQuery}".`
                      : 'No connections discovered on the system.'}
                  </p>
                  <button
                    className="action-btn"
                    onClick={() => {
                      setStateFilter('ALL');
                    }}
                    style={{ margin: '8px auto 0', fontSize: '0.78rem' }}
                  >
                    Reset State Filter
                  </button>
                </div>
              </td>
            </tr>
          ) : groupBy !== 'NONE' ? (
            /* GROUPED RENDERING */
            groupedData.map((group) => {
              const isCollapsed = !!collapsedGroups[group.key];
              return (
                <React.Fragment key={group.key}>
                  {/* Group Header Row */}
                  <tr
                    onClick={() => toggleGroupCollapse(group.key)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderTop: '1px solid var(--border-medium)',
                      borderBottom: '1px solid var(--border-medium)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    <td colSpan={10} style={{ padding: '8px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isCollapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--accent-cyan)" />}
                          {group.icon}
                          <strong style={{ fontSize: '0.86rem', color: '#f8fafc' }}>{group.label}</strong>
                          <span
                            className="badge badge-connected"
                            style={{ fontSize: '0.7rem', padding: '1px 6px', fontWeight: 700 }}
                          >
                            {group.items.length} {group.items.length === 1 ? 'connection' : 'connections'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          {(group.totalBytesIn > 0 || group.totalBytesOut > 0) && (
                            <span className="font-mono" style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ color: '#4ade80' }}>↓ {formatBytesPerSec(group.totalBytesIn)}</span>
                              <span style={{ color: '#38bdf8' }}>↑ {formatBytesPerSec(group.totalBytesOut)}</span>
                            </span>
                          )}
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
                            {isCollapsed ? 'Click to expand' : 'Click to collapse'}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Group Connection Rows */}
                  {!isCollapsed && group.items.map((conn) => renderConnectionRow(conn))}
                </React.Fragment>
              );
            })
          ) : (
            /* FLAT RENDERING */
            paginatedConnections.map((conn) => renderConnectionRow(conn))
          )}
        </tbody>
      </table>

      {/* 4. Table Pagination (Flat view only) */}
      {!isLoading && groupBy === 'NONE' && filtered.length > 0 && (
        <Pagination
          totalItems={filtered.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="connections"
        />
      )}
    </div>
  );
};
