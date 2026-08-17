import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  ArrowRight,
  Search,
} from 'lucide-react';
import { SecurityAlert } from '@network-monitor/shared';

export interface SystemSecurityStatusProps {
  alerts: SecurityAlert[];
  dataExposureCount: number;
  sensitiveFilesCount: number;
  activeAgentsCount: number;
  onReviewAlerts: () => void;
  onOpenInvestigator?: () => void;
}

export type OverallSecurityState = 'SAFE' | 'ATTENTION' | 'HIGH_RISK' | 'CRITICAL';

export const SystemSecurityStatus: React.FC<SystemSecurityStatusProps> = ({
  alerts,
  dataExposureCount,
  sensitiveFilesCount: _sensitiveFilesCount,
  activeAgentsCount,
  onReviewAlerts,
  onOpenInvestigator,
}) => {

  // Derive overall security state strictly from existing backend data
  const hasCritical = alerts.some((a) => a.severity === 'CRITICAL') || dataExposureCount > 0;
  const hasHigh = alerts.some((a) => a.severity === 'HIGH');
  const hasMedium = alerts.some((a) => a.severity === 'MEDIUM') || alerts.length > 0;

  let state: OverallSecurityState = 'SAFE';
  if (hasCritical) {
    state = 'CRITICAL';
  } else if (hasHigh) {
    state = 'HIGH_RISK';
  } else if (hasMedium) {
    state = 'ATTENTION';
  }

  const getConfig = () => {
    switch (state) {
      case 'CRITICAL':
        return {
          icon: <ShieldAlert size={22} color="#f43f5e" />,
          title: 'CRITICAL SECURITY INCIDENT',
          subtitle: 'Potential sensitive data exposure detected. Outbound transfer following sensitive file access requires immediate review.',
          badgeClass: 'badge-disconnected',
          borderLeftColor: '#f43f5e',
          bgGradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.12) 0%, rgba(13, 20, 36, 0.9) 100%)',
          actionText: 'Review Critical Incident',
          actionColor: '#f43f5e',
          pulseDot: 'danger',
        };
      case 'HIGH_RISK':
        return {
          icon: <AlertCircle size={22} color="#f43f5e" />,
          title: 'HIGH RISK DETECTED',
          subtitle: `${alerts.length} security finding${alerts.length === 1 ? '' : 's'} identified. Unusual process or network activity requires review.`,
          badgeClass: 'badge-disconnected',
          borderLeftColor: '#f43f5e',
          bgGradient: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(13, 20, 36, 0.9) 100%)',
          actionText: 'Review Security Events',
          actionColor: '#f43f5e',
          pulseDot: 'danger',
        };
      case 'ATTENTION':
        return {
          icon: <AlertTriangle size={22} color="#f59e0b" />,
          title: 'ATTENTION REQUIRED',
          subtitle: `${alerts.length} security observation${alerts.length === 1 ? '' : 's'} flagged for inspection.`,
          badgeClass: 'badge-connecting',
          borderLeftColor: '#f59e0b',
          bgGradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(13, 20, 36, 0.9) 100%)',
          actionText: 'Review Events',
          actionColor: '#f59e0b',
          pulseDot: 'warning',
        };
      case 'SAFE':
      default:
        return {
          icon: <ShieldCheck size={22} color="#10b981" />,
          title: 'SYSTEM SECURE',
          subtitle: activeAgentsCount > 0
            ? `${activeAgentsCount} AI agent${activeAgentsCount === 1 ? '' : 's'} running within standard behavioral baseline. Zero suspicious exposures detected.`
            : 'Continuous behavioral monitoring active. No suspicious AI agent activity or data exposures detected.',
          badgeClass: 'badge-connected',
          borderLeftColor: '#10b981',
          bgGradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(13, 20, 36, 0.85) 100%)',
          actionText: 'Investigate Activity',
          actionColor: '#10b981',
          pulseDot: 'active',
        };
    }
  };

  const config = getConfig();

  return (
    <div
      className="glass-panel"
      style={{
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        background: config.bgGradient,
        borderLeft: `4px solid ${config.borderLeftColor}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {config.icon}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`status-dot ${config.pulseDot}`} />
            <h3
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
              }}
            >
              {config.title}
            </h3>
          </div>
          <p
            style={{
              margin: '3px 0 0',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {config.subtitle}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {state !== 'SAFE' ? (
          <button
            className="action-btn"
            onClick={onReviewAlerts}
            style={{
              background: `${config.actionColor}20`,
              borderColor: `${config.actionColor}50`,
              color: '#f8fafc',
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '6px 14px',
            }}
          >
            <span>{config.actionText}</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          onOpenInvestigator && (
            <button
              className="action-btn"
              onClick={onOpenInvestigator}
              style={{
                fontSize: '0.78rem',
                padding: '6px 12px',
                color: 'var(--text-secondary)',
              }}
            >
              <Search size={13} />
              <span>AI Investigator</span>
            </button>
          )
        )}
      </div>
    </div>
  );
};
