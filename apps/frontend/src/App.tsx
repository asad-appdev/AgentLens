import React, { useState, useEffect, useCallback } from 'react';
import {
  Network,
  RefreshCw,
  Activity,
  Layers,
  Shield,
  History,
  Download,
  Settings,
  Bell,
  Search,
  Maximize2,
  Minimize2,
  Sliders,
  Cpu,
  Pause,
  Play,
  Bot,
  FileSearch,
  MessageSquareCode,
  Eye,
  Server,
  ShieldAlert,
  AlertTriangle,
  FileCode,
  Clock,
} from 'lucide-react';
import { NetworkConnection, PreparedAction } from '@network-monitor/shared';
import { Header } from './components/Header.js';
import { MetricCard } from './components/MetricCard.js';
import { SearchBar } from './components/SearchBar.js';
import { ConnectionTable } from './components/ConnectionTable.js';
import { ProcessTrafficPanel } from './components/ProcessTrafficPanel.js';
import { BlockedIpPanel } from './components/BlockedIpPanel.js';
import { HistoryDashboard } from './components/HistoryDashboard.js';
import { SettingsPanel } from './components/SettingsPanel.js';
import { AiIntelligenceDashboard } from './components/AiIntelligenceDashboard.js';
import { AiAgentDetailModal } from './components/AiAgentDetailModal.js';
import { InvestigationWorkspaceModal } from './components/InvestigationWorkspaceModal.js';
import { AiAnalystPanel } from './components/AiAnalystPanel.js';
import { WatchRulesModal } from './components/WatchRulesModal.js';
import { ActionConfirmationModal } from './components/ActionConfirmationModal.js';
import { LocalServersPanel } from './components/LocalServersPanel.js';
import { BlockIpModal } from './components/BlockIpModal.js';
import { ExportModal } from './components/ExportModal.js';
import { ProcessInspectorModal } from './components/ProcessInspectorModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { EventCenterDrawer } from './components/EventCenterDrawer.js';
import { DiagnosticsModal } from './components/DiagnosticsModal.js';
import { FirstRunModal } from './components/FirstRunModal.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { SecurityAlertsPanel } from './components/SecurityAlertsPanel.js';
import { SecurityTimelinePanel } from './components/SecurityTimelinePanel.js';
import { SensitiveFilesPanel } from './components/SensitiveFilesPanel.js';
import { SecurityInvestigatorModal } from './components/SecurityInvestigatorModal.js';
import { SystemSecurityStatus } from './components/SystemSecurityStatus.js';
import { RecentActivityFeed } from './components/RecentActivityFeed.js';

import { useWebSocket } from './hooks/useWebSocket.js';
import { useBackendHealth } from './hooks/useBackendHealth.js';
import { useNetworkTraffic } from './hooks/useNetworkTraffic.js';
import { useFirewall } from './hooks/useFirewall.js';
import { useHistory } from './hooks/useHistory.js';
import { useIntelligence } from './hooks/useIntelligence.js';
import { useSystem } from './hooks/useSystem.js';
import { useAiIntelligence } from './hooks/useAiIntelligence.js';
import { useAnalyst } from './hooks/useAnalyst.js';
import { useAutomation } from './hooks/useAutomation.js';
import { useLocalServers } from './hooks/useLocalServers.js';
import { useSecurity } from './hooks/useSecurity.js';
import { fetchConnections, trustSecurityEntity } from './services/api.js';


export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    'ALERTS' | 'AI' | 'TIMELINE' | 'SENSITIVE_FILES' | 'CONNECTIONS' | 'TRAFFIC' | 'SERVERS' | 'ANALYST' | 'FIREWALL' | 'HISTORY' | 'SETTINGS'
  >('ALERTS');

  const [searchQuery, setSearchQuery] = useState('');
  const [snapshotConnections, setSnapshotConnections] = useState<NetworkConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [lastDiscoveredAt, setLastDiscoveredAt] = useState<string | null>(null);

  // UI Modes
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('ALL');

  // Modal & Drawer States
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTargetConnection, setBlockTargetConnection] = useState<NetworkConnection | null>(null);
  const [blockTargetIp, setBlockTargetIp] = useState<string | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [investigationModalOpen, setInvestigationModalOpen] = useState(false);
  const [watchRulesModalOpen, setWatchRulesModalOpen] = useState(false);
  const [selectedPreparedAction, setSelectedPreparedAction] = useState<PreparedAction | null>(null);
  const [inspectedPid, setInspectedPid] = useState<number | null>(null);
  const [inspectedProcessDetail, setInspectedProcessDetail] = useState<any>(null);
  const [inspectedAgentId, setInspectedAgentId] = useState<string | null>(null);
  const [securityInvestigatorModalOpen, setSecurityInvestigatorModalOpen] = useState(false);
  const [investigatorTargetId, setInvestigatorTargetId] = useState<string | null>(null);

  const isSecurityTab = activeTab === 'ALERTS' || activeTab === 'TIMELINE' || activeTab === 'SENSITIVE_FILES';

  const {
    alerts: securityAlerts,
    timelineEvents: securityTimelineEvents,
    sensitiveFiles: securitySensitiveFiles,
    dataExposureCount,
    refresh: refreshSecurity,
    dismissAlert: dismissSecurityAlertItem,
    clearHistory: clearSecurityHistoryData,
  } = useSecurity(isSecurityTab ? 3000 : 10000);

  const {
    status: wsStatus,
    connections: wsConnections,
    totalConnections: wsTotalCount,
    latencyMs,
    sendPing,
    reconnect: reconnectWs,
  } = useWebSocket();


  const {
    status: healthStatus,
    refetch: refetchHealth,
  } = useBackendHealth();

  const {
    filteredProcesses,
    filter: trafficFilter,
    setFilter: setTrafficFilter,
    sortField: trafficSortField,
    sortDirection: trafficSortDirection,
    setSort: setTrafficSort,
    selectedProcess,
    setSelectedProcess,
    refreshTraffic,
    isLoading: isLoadingTraffic,
  } = useNetworkTraffic(2000);


  const {
    blockedIps,
    status: firewallStatus,
    isLoading: isFirewallLoading,
    blockIp,
    unblockIp,
    isBlocked,
    refreshBlockedIps,
  } = useFirewall();

  const {
    summary: historySummary,
    timeline: historyTimeline,
    status: historyStatus,
    topIps: historyTopIps,
    timeRange: historyTimeRange,
    setTimeRange: setHistoryTimeRange,
    toggleRecording: toggleHistoryRecording,
    clearHistory,
    refreshHistory,
    isLoading: isLoadingHistory,
  } = useHistory(activeTab === 'HISTORY' ? 3000 : 0);

  const {
    settings,
    events,
    unreadEventCount,
    inspectProcess,
    toggleFavorite,
    setProcessLabel,
    setTags,
    updateSettings,
    markEventsRead,
    clearEvents,
    refreshEvents,
  } = useIntelligence();

  const {
    diagnostics,
    backups,
    isPaused,
    isLoading: isSystemLoading,
    togglePause,
    fetchDiagnostics,
    createBackup,
    restoreBackup,
  } = useSystem();

  const {
    profiles: aiProfiles,
    indicators: aiIndicators,
    suggestions: aiSuggestions,
    graphData: aiGraphData,
    investigations,
    updateSuggestionStatus,
    createInvestigation,
    pinToInvestigation,
    addInvestigationNote,
    deleteInvestigation,
    refreshAll: refreshAiIntelligence,
  } = useAiIntelligence();

  const {
    messages: analystMessages,
    isLoading: isAnalystLoading,
    config: analystConfig,
    availableModels: analystModels,
    sendQuery: sendAnalystQuery,
    updateConfig: updateAnalystConfig,
  } = useAnalyst();

  const {
    watchRules,
    confirmAction,
    createWatchRule,
    deleteWatchRule,
  } = useAutomation();

  const {
    servers: localServers,
    isLoading: isLoadingLocalServers,
    fetchServers: refreshLocalServers,
    killProcesses,
  } = useLocalServers(activeTab === 'SERVERS' ? 3000 : 8000);

  // Load snapshot via GET /api/connections
  const loadSnapshot = useCallback(async () => {
    setIsLoadingConnections(true);
    try {
      const res = await fetchConnections();
      setSnapshotConnections(res.connections);
      setLastDiscoveredAt(res.timestamp);
    } catch (err) {
      console.error('Failed to fetch connections snapshot:', err);
    } finally {
      setIsLoadingConnections(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('CONNECTIONS');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('TRAFFIC');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('SERVERS');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '4') {
        e.preventDefault();
        setActiveTab('AI');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '5') {
        e.preventDefault();
        setActiveTab('ANALYST');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '6') {
        e.preventDefault();
        setActiveTab('FIREWALL');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '7') {
        e.preventDefault();
        setActiveTab('HISTORY');
      } else if ((e.metaKey || e.ctrlKey) && e.key === '8') {
        e.preventDefault();
        setActiveTab('SETTINGS');
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setExportModalOpen(false);
        setBlockModalOpen(false);
        setEventDrawerOpen(false);
        setDiagnosticsModalOpen(false);
        setInvestigationModalOpen(false);
        setWatchRulesModalOpen(false);
        setSelectedPreparedAction(null);
        setInspectedPid(null);
        setInspectedAgentId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeConnections = wsConnections.length > 0 ? wsConnections : snapshotConnections;
  const totalCount = wsConnections.length > 0 ? wsTotalCount : snapshotConnections.length;

  // Preset Filtering Logic
  const presetFilteredConnections = React.useMemo(() => {
    switch (selectedPreset) {
      case 'AI':
        return activeConnections.filter((c) => !!c.isAiAgent);
      case 'HIGH_TRAFFIC':
        return activeConnections.filter((c) => (c.traffic?.totalBytesPerSecond || 0) > 102400);
      case 'ACTIVE_TCP':
        return activeConnections.filter((c) => c.protocol === 'TCP' && c.state === 'ESTABLISHED');
      case 'FAVORITES':
        return activeConnections.filter((c) =>
          settings?.favoritePids.includes(c.pid) || (c.processName && settings?.favoriteProcessNames.includes(c.processName))
        );
      default:
        return activeConnections;
    }
  }, [activeConnections, selectedPreset, settings]);

  const handleOpenProcessInspect = async (pid: number) => {
    setInspectedPid(pid);
    const detail = await inspectProcess(pid);
    setInspectedProcessDetail(detail);
  };

  const handleInitiateBlock = (conn: NetworkConnection) => {
    if (!conn.remoteAddress) return;
    setBlockTargetConnection(conn);
    setBlockTargetIp(conn.remoteAddress);
    setBlockModalOpen(true);
  };

  const handleConfirmBlock = async (ip: string, comment?: string): Promise<boolean> => {
    const res = await blockIp(ip, comment);
    if (res.success) {
      await loadSnapshot();
      return true;
    }
    return false;
  };

  const handleOpenDiagnostics = async () => {
    await fetchDiagnostics();
    setDiagnosticsModalOpen(true);
  };

  const handleAnalystActionClick = (actionType: string, target: string) => {
    if (actionType === 'view_agent') {
      if (target === 'all') {
        setActiveTab('AI');
      } else {
        setInspectedAgentId(target);
      }
    } else if (actionType === 'view_process') {
      const pid = parseInt(target, 10);
      if (!isNaN(pid)) {
        handleOpenProcessInspect(pid);
      }
    } else if (actionType === 'view_ip') {
      setBlockTargetIp(target);
      setBlockModalOpen(true);
    } else if (actionType === 'open_investigation') {
      if (target === 'watch_rules') {
        setWatchRulesModalOpen(true);
      } else {
        setInvestigationModalOpen(true);
      }
    } else if (actionType === 'filter_traffic') {
      setActiveTab('CONNECTIONS');
      setSelectedPreset(target === 'top' ? 'HIGH_TRAFFIC' : 'ALL');
    }
  };

  const handleRefreshAll = () => {
    sendPing();
    refetchHealth();
    loadSnapshot();
    refreshTraffic();
    refreshBlockedIps();
    refreshHistory();
    refreshEvents();
    refreshAiIntelligence();
    refreshLocalServers();
    if (wsStatus === 'disconnected') {
      reconnectWs();
    }
  };

  const activeAgentDetail = aiProfiles.find((p) => p.agentId === inspectedAgentId) || null;

  return (
    <ErrorBoundary>
      <div className={`app-container ${isFocusMode ? 'focus-mode' : ''}`}>
        {/* Top Header */}
        {!isFocusMode && (
          <Header
            wsStatus={wsStatus}
            latencyMs={latencyMs}
            healthStatus={healthStatus}
            onRefresh={handleRefreshAll}
          />
        )}

        {/* 1. Prominent System Security Status (Derived from real backend state) */}
        {!isFocusMode && (
          <SystemSecurityStatus
            alerts={securityAlerts}
            dataExposureCount={dataExposureCount}
            sensitiveFilesCount={securitySensitiveFiles.length}
            activeAgentsCount={aiProfiles.filter((p) => p.processCount > 0).length}
            onReviewAlerts={() => setActiveTab('ALERTS')}
            onOpenInvestigator={() => {
              setInvestigatorTargetId(aiProfiles.find((p) => p.processCount > 0)?.displayName || 'system');
              setSecurityInvestigatorModalOpen(true);
            }}
          />
        )}

        {/* 2. Metrics Overview Cards - Single Row Security Hierarchy */}
        {!isFocusMode && (
          <section className="metrics-grid">
            <MetricCard
              title="AI Agents"
              value={`${aiProfiles.filter((p) => p.processCount > 0).length} Active`}
              footnote="Claude, Codex, Ollama..."
              icon={<Bot size={15} />}
              accentColor="#00f0ff"
            />
            <MetricCard
              title="Current Risk"
              value={
                securityAlerts.some((a) => a.severity === 'CRITICAL') || dataExposureCount > 0
                  ? '85 / 100'
                  : securityAlerts.some((a) => a.severity === 'HIGH')
                  ? '72 / 100'
                  : securityAlerts.some((a) => a.severity === 'MEDIUM') || securityAlerts.length > 0
                  ? '45 / 100'
                  : aiProfiles.some((p) => p.processCount > 0)
                  ? '14 / 100'
                  : '0 / 100'
              }
              footnote={
                securityAlerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH') || dataExposureCount > 0
                  ? 'HIGH RISK • Review findings'
                  : securityAlerts.some((a) => a.severity === 'MEDIUM') || securityAlerts.length > 0
                  ? 'MEDIUM • Attention required'
                  : 'LOW • Behavioral baseline'
              }
              icon={<ShieldAlert size={15} />}
              accentColor={
                securityAlerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH') || dataExposureCount > 0
                  ? '#f43f5e'
                  : securityAlerts.some((a) => a.severity === 'MEDIUM') || securityAlerts.length > 0
                  ? '#f59e0b'
                  : '#10b981'
              }
            />
            <MetricCard
              title="Security Alerts"
              value={securityAlerts.length}
              footnote={securityAlerts.length > 0 ? `${securityAlerts.length} action required` : 'All systems secure'}
              icon={<ShieldAlert size={15} />}
              accentColor={securityAlerts.length > 0 ? '#f43f5e' : '#10b981'}
            />
            <MetricCard
              title="Sensitive Files"
              value={securitySensitiveFiles.length}
              footnote="Metadata (Zero content stored)"
              icon={<FileCode size={15} />}
              accentColor="#f59e0b"
            />
            <MetricCard
              title="Exposures"
              value={dataExposureCount}
              footnote="Correlated anomaly signals"
              icon={<AlertTriangle size={15} />}
              accentColor={dataExposureCount > 0 ? '#f43f5e' : '#10b981'}
            />
            <MetricCard
              title="Connections"
              value={totalCount}
              footnote={lastDiscoveredAt ? `Discovered: ${new Date(lastDiscoveredAt).toLocaleTimeString()}` : 'Live connections'}
              icon={<Network size={15} />}
              accentColor="#10b981"
            />
          </section>
        )}

        {/* Modern Segmented Navigation & Control Bar */}
        <section className="nav-segmented-section">
          <div className="nav-segmented-bar">
            {/* AI & Security Guard Group */}
            <div className="nav-tabs-group">
              <button
                className={`nav-tab-btn ${activeTab === 'ALERTS' ? 'active' : ''}`}
                onClick={() => setActiveTab('ALERTS')}
              >
                <ShieldAlert size={15} color={securityAlerts.length > 0 ? '#f43f5e' : undefined} />
                <span>Security Alerts</span>
                {securityAlerts.length > 0 ? (
                  <span className="nav-tab-badge danger">{securityAlerts.length}</span>
                ) : (
                  <span className="nav-tab-badge">0</span>
                )}
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'AI' ? 'active' : ''}`}
                onClick={() => setActiveTab('AI')}
              >
                <Bot size={15} />
                <span>AI Agents</span>
                <span className="nav-tab-badge">{aiProfiles.filter((p) => p.processCount > 0).length}</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'TIMELINE' ? 'active' : ''}`}
                onClick={() => setActiveTab('TIMELINE')}
              >
                <Clock size={15} />
                <span>Security Timeline</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'SENSITIVE_FILES' ? 'active' : ''}`}
                onClick={() => setActiveTab('SENSITIVE_FILES')}
              >
                <FileCode size={15} />
                <span>Sensitive Files</span>
                <span className="nav-tab-badge">{securitySensitiveFiles.length}</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'ANALYST' ? 'active' : ''}`}
                onClick={() => setActiveTab('ANALYST')}
              >
                <MessageSquareCode size={15} />
                <span>AI Investigator</span>
              </button>
            </div>

            <div className="nav-divider" />

            {/* Network & System Group */}
            <div className="nav-tabs-group">
              <button
                className={`nav-tab-btn ${activeTab === 'CONNECTIONS' ? 'active' : ''}`}
                onClick={() => setActiveTab('CONNECTIONS')}
              >
                <Layers size={15} />
                <span>Connections</span>
                <span className="nav-tab-badge">{totalCount}</span>
              </button>


              <button
                className={`nav-tab-btn ${activeTab === 'SERVERS' ? 'active' : ''}`}
                onClick={() => setActiveTab('SERVERS')}
              >
                <Server size={15} />
                <span>Dev Servers</span>
                <span className="nav-tab-badge">{localServers.length}</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'TRAFFIC' ? 'active' : ''}`}
                onClick={() => setActiveTab('TRAFFIC')}
              >
                <Activity size={15} />
                <span>Traffic</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'FIREWALL' ? 'active' : ''}`}
                onClick={() => setActiveTab('FIREWALL')}
              >
                <Shield size={15} />
                <span>Firewall</span>
                <span className="nav-tab-badge">{blockedIps.length}</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'HISTORY' ? 'active' : ''}`}
                onClick={() => setActiveTab('HISTORY')}
              >
                <History size={15} />
                <span>History</span>
              </button>

              <button
                className={`nav-tab-btn ${activeTab === 'SETTINGS' ? 'active' : ''}`}
                onClick={() => setActiveTab('SETTINGS')}
              >
                <Settings size={15} />
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Secondary Controls Bar */}
          <div className="glass-panel toolbar-section">
            {activeTab === 'CONNECTIONS' ? (
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search connections (Port, PID, Process, IP, State, AI agent)..."
              />
            ) : (
              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f0ff' }} />
                <span>
                  Viewing <strong>{activeTab.replace('_', ' ')}</strong> — Real-time telemetry updating every 2s
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Pause / Resume Button */}
              <button
                className={`action-btn ${isPaused ? 'active' : ''}`}
                onClick={togglePause}
                style={{ fontSize: '0.78rem', gap: '6px', color: isPaused ? '#fbbf24' : 'inherit' }}
                title={isPaused ? 'Resume live monitoring' : 'Pause live monitoring'}
              >
                {isPaused ? <Play size={13} color="#fbbf24" /> : <Pause size={13} />}
                <span>{isPaused ? 'Resumed' : 'Pause'}</span>
              </button>

              {/* Watch Rules Button */}
              <button
                className="action-btn"
                onClick={() => setWatchRulesModalOpen(true)}
                style={{ fontSize: '0.78rem', gap: '6px' }}
                title="Automated Watch Rules"
              >
                <Eye size={13} />
                <span>Watch Rules</span>
              </button>

              {/* Investigations Button */}
              <button
                className="action-btn"
                onClick={() => setInvestigationModalOpen(true)}
                style={{ fontSize: '0.78rem', gap: '6px' }}
                title="Open Investigation Workspace"
              >
                <FileSearch size={13} />
                <span>Workspace</span>
              </button>

              {/* Diagnostics Button */}
              <button
                className="action-btn"
                onClick={handleOpenDiagnostics}
                style={{ fontSize: '0.78rem', gap: '6px' }}
                title="Open System Health & Diagnostics"
              >
                <Cpu size={13} />
                <span>Diagnostics</span>
              </button>

              {/* Command Palette Button */}
              <button
                className="action-btn"
                onClick={() => setCommandPaletteOpen(true)}
                style={{ fontSize: '0.78rem', gap: '6px' }}
                title="Command Palette (⌘K)"
              >
                <Search size={13} />
                <span>⌘K</span>
              </button>

              {/* Event Center Bell */}
              <button
                className="action-btn"
                onClick={() => setEventDrawerOpen(true)}
                style={{ position: 'relative', padding: '6px 10px' }}
                title="Open Local Event Center"
              >
                <Bell size={14} color={unreadEventCount > 0 ? '#fbbf24' : 'var(--text-secondary)'} />
                {unreadEventCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      background: 'var(--accent-rose)',
                      color: '#fff',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      padding: '1px 5px',
                      fontWeight: 700,
                    }}
                  >
                    {unreadEventCount}
                  </span>
                )}
              </button>

              {/* Compact Mode Toggle */}
              <button
                className={`action-btn ${isCompactMode ? 'active' : ''}`}
                onClick={() => setIsCompactMode(!isCompactMode)}
                style={{ padding: '6px 10px' }}
                title={isCompactMode ? 'Disable Compact View' : 'Enable High-Density Compact View'}
              >
                <Sliders size={14} />
              </button>

              {/* Focus Mode Toggle */}
              <button
                className={`action-btn ${isFocusMode ? 'active' : ''}`}
                onClick={() => setIsFocusMode(!isFocusMode)}
                style={{ padding: '6px 10px' }}
                title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
              >
                {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              {/* Export Button */}
              <button
                className="action-btn"
                onClick={() => setExportModalOpen(true)}
                style={{ fontSize: '0.78rem', gap: '6px' }}
              >
                <Download size={13} />
                <span>Export</span>
              </button>

              <button
                className="action-btn"
                onClick={
                  activeTab === 'CONNECTIONS'
                    ? loadSnapshot
                    : activeTab === 'TRAFFIC'
                    ? refreshTraffic
                    : activeTab === 'SERVERS'
                    ? refreshLocalServers
                    : activeTab === 'FIREWALL'
                    ? refreshBlockedIps
                    : refreshHistory
                }
                disabled={isLoadingConnections || isLoadingTraffic || isFirewallLoading || isLoadingHistory || isLoadingLocalServers}
              >
                <RefreshCw size={13} className={isLoadingConnections || isLoadingTraffic || isFirewallLoading || isLoadingHistory || isLoadingLocalServers ? 'spin' : ''} />
              </button>
            </div>
          </div>
        </section>


        {/* Preset Filter Bar (for Connections view) */}
        {activeTab === 'CONNECTIONS' && (

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Connections' },
              { id: 'AI', label: '🤖 AI Agent Activity' },
              { id: 'HIGH_TRAFFIC', label: '⚡ High Traffic (> 100 KB/s)' },
              { id: 'ACTIVE_TCP', label: '🌐 Active TCP' },
              { id: 'FAVORITES', label: '⭐ Favorites' },
            ].map((preset) => (

              <button
                key={preset.id}
                className={`action-btn ${selectedPreset === preset.id ? 'active' : ''}`}
                onClick={() => setSelectedPreset(preset.id)}
                style={{
                  fontSize: '0.76rem',
                  padding: '4px 12px',
                  background: selectedPreset === preset.id ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: selectedPreset === preset.id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                  color: selectedPreset === preset.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        <main>
          {activeTab === 'ALERTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SecurityAlertsPanel
                alerts={securityAlerts}
                onInvestigate={(id) => {
                  setInvestigatorTargetId(id);
                  setSecurityInvestigatorModalOpen(true);
                }}
                onBlockIp={(ip) => {
                  setBlockTargetIp(ip);
                  setBlockModalOpen(true);
                }}
                onKillPid={(pid) => killProcesses([pid])}
                onDismiss={(id) => dismissSecurityAlertItem(id)}
                onTrust={async (type, val, alertId) => {
                  await trustSecurityEntity(type, val, undefined, alertId);
                  refreshSecurity();
                }}
              />
              <RecentActivityFeed
                events={securityTimelineEvents}
                onSelectEvent={(evt) => {
                  setInvestigatorTargetId(evt.agentName || evt.processName);
                  setSecurityInvestigatorModalOpen(true);
                }}
              />
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <SecurityTimelinePanel
              events={securityTimelineEvents}
              onClearHistory={clearSecurityHistoryData}
            />
          )}

          {activeTab === 'SENSITIVE_FILES' && (
            <SensitiveFilesPanel files={securitySensitiveFiles} />
          )}

          {activeTab === 'CONNECTIONS' && (
            <ConnectionTable
              connections={presetFilteredConnections}
              filterQuery={searchQuery}
              isLoading={isLoadingConnections}
              isCompact={isCompactMode}
              isIpBlocked={isBlocked}
              isFavorite={(pid, name) =>
                (settings?.favoritePids.includes(pid) || (!!name && settings?.favoriteProcessNames.includes(name))) ?? false
              }
              onInitiateBlock={handleInitiateBlock}
              onInspectProcess={handleOpenProcessInspect}
              onInspectRemoteIp={(ip) => {
                setBlockTargetIp(ip);
                setBlockModalOpen(true);
              }}
            />
          )}


          {activeTab === 'TRAFFIC' && (
            <ProcessTrafficPanel
              processes={filteredProcesses}
              filter={trafficFilter}
              setFilter={setTrafficFilter}
              sortField={trafficSortField}
              sortDirection={trafficSortDirection}
              onSort={setTrafficSort}
              selectedProcess={selectedProcess}
              onSelectProcess={(proc) => {
                setSelectedProcess(proc);
                if (proc) handleOpenProcessInspect(proc.pid);
              }}
            />
          )}

          {activeTab === 'SERVERS' && (
            <LocalServersPanel
              servers={localServers}
              isLoading={isLoadingLocalServers}
              onRefresh={refreshLocalServers}
              onKillProcesses={killProcesses}
            />
          )}

          {activeTab === 'AI' && (
            <AiIntelligenceDashboard
              profiles={aiProfiles}
              indicators={aiIndicators}
              suggestions={aiSuggestions}
              securityAlerts={securityAlerts}
              graphData={aiGraphData}
              onSelectAgent={(agentId) => setInspectedAgentId(agentId)}
              onUpdateSuggestion={updateSuggestionStatus}
              onInitiateBlockIp={(ip) => {
                setBlockTargetIp(ip);
                setBlockModalOpen(true);
              }}
              onOpenInvestigations={() => setInvestigationModalOpen(true)}
              onPinItem={(item) => {
                if (investigations[0]) {
                  pinToInvestigation(investigations[0].id, item);
                  setInvestigationModalOpen(true);
                }
              }}
            />
          )}


          {activeTab === 'ANALYST' && (
            <AiAnalystPanel
              messages={analystMessages}
              isLoading={isAnalystLoading}
              config={analystConfig}
              availableModels={analystModels}
              onSendMessage={sendAnalystQuery}
              onUpdateConfig={updateAnalystConfig}
              onActionClick={handleAnalystActionClick}
            />
          )}

          {activeTab === 'FIREWALL' && (
            <BlockedIpPanel
              blockedIps={blockedIps}
              status={firewallStatus}
              onBlockIp={blockIp}
              onUnblockIp={unblockIp}
              isLoading={isFirewallLoading}
            />
          )}

          {activeTab === 'HISTORY' && (
            <HistoryDashboard
              summary={historySummary}
              timeline={historyTimeline}
              status={historyStatus}
              topIps={historyTopIps}
              timeRange={historyTimeRange}
              onTimeRangeChange={setHistoryTimeRange}
              onToggleRecording={toggleHistoryRecording}
              onClearHistory={clearHistory}
              liveConnections={activeConnections}
              isLoading={isLoadingHistory}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <SettingsPanel
              settings={settings}
              onUpdateSettings={updateSettings}
            />
          )}
        </main>

        {/* Action Confirmation Modal */}
        <ActionConfirmationModal
          action={selectedPreparedAction}
          isOpen={selectedPreparedAction !== null}
          onClose={() => setSelectedPreparedAction(null)}
          onConfirm={async (actionId) => {
            const res = await confirmAction(actionId);
            if (res.success && res.result) {
              if (selectedPreparedAction?.actionType === 'PREPARE_BLOCK_IP') {
                setBlockTargetIp(res.result.ip);
                setBlockModalOpen(true);
              } else if (selectedPreparedAction?.actionType === 'CREATE_INVESTIGATION') {
                setInvestigationModalOpen(true);
              }
            }
          }}
        />

        {/* Watch Rules Modal */}
        <WatchRulesModal
          rules={watchRules}
          isOpen={watchRulesModalOpen}
          onClose={() => setWatchRulesModalOpen(false)}
          onCreateRule={createWatchRule}
          onDeleteRule={deleteWatchRule}
        />

        {/* Block IP Confirmation Modal */}
        <BlockIpModal
          connection={blockTargetConnection}
          targetIp={blockTargetIp}
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          onConfirmBlock={handleConfirmBlock}
        />

        {/* Export Modal */}
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
        />

        {/* Process Inspector Modal */}
        <ProcessInspectorModal
          detail={inspectedProcessDetail}
          isOpen={inspectedPid !== null}
          onClose={() => setInspectedPid(null)}
          onToggleFavorite={toggleFavorite}
          onSetLabel={setProcessLabel}
          onSetTags={setTags}
          onBlockIp={(ip) => {
            setBlockTargetIp(ip);
            setBlockModalOpen(true);
          }}
        />

        {/* AI Agent Detail Modal */}
        <AiAgentDetailModal
          profile={activeAgentDetail}
          isOpen={inspectedAgentId !== null}
          onClose={() => setInspectedAgentId(null)}
          onInitiateBlockIp={(ip) => {
            setBlockTargetIp(ip);
            setBlockModalOpen(true);
          }}
          onPinItem={(item) => {
            if (investigations[0]) {
              pinToInvestigation(investigations[0].id, item);
              setInvestigationModalOpen(true);
            }
          }}
        />

        {/* Investigation Workspace Modal */}
        <InvestigationWorkspaceModal
          isOpen={investigationModalOpen}
          onClose={() => setInvestigationModalOpen(false)}
          investigations={investigations}
          onCreateInvestigation={createInvestigation}
          onAddNote={addInvestigationNote}
          onDeleteInvestigation={deleteInvestigation}
        />

        {/* Diagnostics Modal */}
        <DiagnosticsModal
          isOpen={diagnosticsModalOpen}
          onClose={() => setDiagnosticsModalOpen(false)}
          report={diagnostics}
          backups={backups}
          isLoading={isSystemLoading}
          onRefresh={fetchDiagnostics}
          onCreateBackup={createBackup}
          onRestoreBackup={restoreBackup}
        />

        {/* Security Investigator Modal */}
        <SecurityInvestigatorModal
          isOpen={securityInvestigatorModalOpen}
          onClose={() => setSecurityInvestigatorModalOpen(false)}
          targetId={investigatorTargetId}
        />

        {/* First-Run Onboarding Modal */}
        <FirstRunModal />


        {/* Command Palette (Cmd+K) */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          connections={activeConnections}
          onSelectTab={(tab) => setActiveTab(tab as any)}
          onOpenExport={() => setExportModalOpen(true)}
          onInspectProcess={handleOpenProcessInspect}
          onToggleCompact={() => setIsCompactMode(!isCompactMode)}
          isCompact={isCompactMode}
          onToggleFocus={() => setIsFocusMode(!isFocusMode)}
          isFocus={isFocusMode}
          onSendPing={sendPing}
        />

        {/* Local Event Center Drawer */}
        <EventCenterDrawer
          isOpen={eventDrawerOpen}
          onClose={() => setEventDrawerOpen(false)}
          events={events}
          unreadCount={unreadEventCount}
          onMarkRead={markEventsRead}
          onClear={clearEvents}
          onInspectProcess={handleOpenProcessInspect}
        />

        {/* Footer */}
        {!isFocusMode && (
          <footer className="footer-info">
            <div>AgentLens &bull; Local AI Agent & Network Intelligence Dashboard</div>
            <div>Keyboard Shortcuts: <kbd>⌘K</kbd> Command Palette &bull; <kbd>⌘1–8</kbd> Switch Views &bull; <kbd>ESC</kbd> Close Modals</div>
          </footer>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
