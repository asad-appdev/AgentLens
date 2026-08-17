import React, { useState } from 'react';
import {
  AiAgentProfile,
  BehaviorIndicator,
  SmartFirewallSuggestion,
  NetworkRelationshipGraphData,
  SecurityAlert,
} from '@network-monitor/shared';
import {
  Bot,
  Sparkles,
  FileSearch,
  Search,
  Info,
  Ban,
} from 'lucide-react';
import { NetworkRelationshipGraph } from './NetworkRelationshipGraph.js';
import { formatBytes, formatBytesPerSec } from '../utils/formatters.js';

export interface AiIntelligenceDashboardProps {
  profiles: AiAgentProfile[];
  indicators: BehaviorIndicator[];
  suggestions: SmartFirewallSuggestion[];
  securityAlerts?: SecurityAlert[];
  graphData: NetworkRelationshipGraphData | null;
  onSelectAgent: (agentId: string) => void;
  onUpdateSuggestion: (id: string, status: SmartFirewallSuggestion['status']) => Promise<boolean>;
  onInitiateBlockIp: (ip: string) => void;
  onOpenInvestigations: () => void;
  onPinItem?: (item: { type: any; targetId: string; title: string }) => void;
}

export const AiIntelligenceDashboard: React.FC<AiIntelligenceDashboardProps> = ({
  profiles,
  indicators,
  suggestions,
  securityAlerts = [],
  graphData,
  onSelectAgent,
  onUpdateSuggestion,
  onInitiateBlockIp,
  onOpenInvestigations,
  onPinItem: _onPinItem,
}) => {
  const [showInactiveDetails, setShowInactiveDetails] = useState<Record<string, boolean>>({});


  // 1. Sort active agents first, then by risk / activity
  const sortedProfiles = React.useMemo(() => {
    return [...profiles].sort((a, b) => {
      const aActive = a.processCount > 0 ? 1 : 0;
      const bActive = b.processCount > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      // If both active, sort by bandwidth rate
      const aRate = a.currentDownloadRate + a.currentUploadRate;
      const bRate = b.currentDownloadRate + b.currentUploadRate;
      return bRate - aRate;
    });
  }, [profiles]);

  const activeAgents = profiles.filter((p) => p.processCount > 0);
  const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING');

  const toggleInactiveDetail = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInactiveDetails((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  };

  const getAgentRiskScore = (agent: AiAgentProfile) => {
    // Correlate with alerts for this agent if available
    const relatedAlerts = securityAlerts.filter(
      (a) => a.agentId === agent.agentId || a.processName.toLowerCase() === agent.agentId.toLowerCase()
    );
    if (relatedAlerts.some((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH')) {
      return { score: 78, level: 'HIGH' };
    }
    if (relatedAlerts.some((a) => a.severity === 'MEDIUM')) {
      return { score: 45, level: 'MEDIUM' };
    }
    if (agent.processCount > 0) {
      return { score: 14, level: 'LOW' };
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Section Header & Workspace Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} color="var(--accent-cyan)" />
            <span>AI Agents & Developer Assistants</span>
            <span className="badge badge-connected" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              {activeAgents.length} Active • {profiles.length} Known Runtimes
            </span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Real-time process tree mapping, socket telemetry, and behavioral baselines for local AI agent runtimes.
          </p>
        </div>

        <button
          className="action-btn"
          onClick={onOpenInvestigations}
          style={{ fontSize: '0.8rem', gap: '6px' }}
        >
          <FileSearch size={14} />
          <span>Investigation Workspace</span>
        </button>
      </div>

      {/* AI Agents Cards Grid (Active First) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
        {sortedProfiles.map((agent) => {
          const isActive = agent.processCount > 0;
          const risk = getAgentRiskScore(agent);
          const isExpanded = !!showInactiveDetails[agent.agentId];

          if (isActive) {
            // Active Agent Card (Rich, High-Visibility)
            return (
              <div
                key={agent.agentId}
                className="glass-panel"
                style={{
                  padding: '16px 18px',
                  cursor: 'pointer',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.06) 0%, rgba(13, 20, 36, 0.95) 100%)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onClick={() => onSelectAgent(agent.agentId)}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#f8fafc', fontWeight: 800 }}>{agent.displayName}</strong>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 7px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                        }}
                      >
                        <span className="status-dot active" style={{ width: 6, height: 6 }} />
                        Active
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>PID {agent.pids.join(', ')}</span>
                      <span>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{agent.category.replace('-', ' ')}</span>
                    </div>
                  </div>

                  {risk && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        background: risk.level === 'HIGH' ? 'rgba(244, 63, 94, 0.16)' : 'rgba(16, 185, 129, 0.14)',
                        color: risk.level === 'HIGH' ? '#fb7185' : '#34d399',
                        border: `1px solid ${risk.level === 'HIGH' ? 'rgba(244, 63, 94, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
                      }}
                    >
                      Risk {risk.score}/100
                    </span>
                  )}
                </div>

                {/* Telemetry Stats Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Connections:</span>
                    <strong className="font-mono" style={{ color: '#00f0ff' }}>
                      {agent.connectionsCount} sockets
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Remote Hosts:</span>
                    <strong className="font-mono" style={{ color: '#c084fc' }}>
                      {agent.remoteHostsCount} destinations
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Traffic In:</span>
                    <strong className="font-mono" style={{ color: '#10b981' }}>
                      ↓ {formatBytesPerSec(agent.currentDownloadRate)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Traffic Out:</span>
                    <strong className="font-mono" style={{ color: '#38bdf8' }}>
                      ↑ {formatBytesPerSec(agent.currentUploadRate)}
                    </strong>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Total {formatBytes(agent.downloadBytes + agent.uploadBytes)}
                  </span>
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAgent(agent.agentId);
                    }}
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      background: 'rgba(0, 240, 255, 0.12)',
                      borderColor: 'rgba(0, 240, 255, 0.35)',
                      color: '#00f0ff',
                      fontWeight: 700,
                    }}
                  >
                    <Search size={12} />
                    <span>Investigate</span>
                  </button>
                </div>
              </div>
            );
          }

          // Inactive Agent Card (Compact, Collapsed Zero-Value Info)
          return (
            <div
              key={agent.agentId}
              className="glass-panel"
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.015)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
              onClick={() => onSelectAgent(agent.agentId)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>{agent.displayName}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', background: 'rgba(255, 255, 255, 0.04)', padding: '1px 6px', borderRadius: 4 }}>
                      ⚪ Not detected
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                    {agent.category.replace('-', ' ')}
                  </div>
                </div>

                <button
                  className="action-btn"
                  onClick={(e) => toggleInactiveDetail(agent.agentId, e)}
                  style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--text-muted)' }}
                >
                  <span>{isExpanded ? 'Hide' : 'Details'}</span>
                </button>
              </div>

              {isExpanded && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(0, 0, 0, 0.25)',
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div>Detection Confidence: <strong style={{ color: 'var(--text-secondary)' }}>{agent.confidence}</strong></div>
                  <div>Listening Ports: <span className="font-mono">{agent.listeningPorts.join(', ') || 'None'}</span></div>
                  <div>Status: <span style={{ color: 'var(--text-dim)' }}>Process not currently active on host</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Network Relationship Graph */}
      <NetworkRelationshipGraph
        data={graphData}
        onSelectNode={(nodeId) => onSelectAgent(nodeId)}
      />

      {/* Behavior Observations & Security Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Behavior Indicators with Evidence */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#fbbf24" />
              <span>Observable Behavior Indicators</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {indicators.length} Observed
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {indicators.length > 0 ? (
              indicators.map((ind) => (
                <div
                  key={ind.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(245, 158, 11, 0.04)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ color: '#fbbf24', fontSize: '0.86rem' }}>
                      {ind.label.toUpperCase()}: {ind.entityId}
                    </strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(ind.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.45, fontSize: '0.8rem' }}>
                    {ind.explanation}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '24px 16px' }}>
                ✓ All observed AI processes are operating within normal baseline activity.
              </div>
            )}
          </div>
        </div>

        {/* Behavior Observations (Replaced noisy "106 recommendations" label) */}
        <div className="glass-panel" style={{ padding: '18px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} color="var(--accent-blue)" />
              <span>Behavior Observations</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {pendingSuggestions.length} Observations • {securityAlerts.length} Security Finding{securityAlerts.length === 1 ? '' : 's'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
            {pendingSuggestions.length > 0 ? (
              pendingSuggestions.map((sug) => (
                <div
                  key={sug.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.4 }}>
                    {sug.reason}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      className="action-btn"
                      onClick={() => onInitiateBlockIp(sug.remoteIp)}
                      style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                    >
                      <Ban size={12} />
                      <span>Block IP</span>
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => onUpdateSuggestion(sug.id, 'IGNORED')}
                      style={{ fontSize: '0.72rem', padding: '3px 8px', color: 'var(--text-muted)' }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '24px 16px' }}>
                No active security findings or firewall observations pending review.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
