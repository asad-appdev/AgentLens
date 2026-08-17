import React from 'react';
import { UserAppSettings } from '@network-monitor/shared';
import { Settings, Bell, Sliders, ShieldCheck } from 'lucide-react';

export interface SettingsPanelProps {
  settings: UserAppSettings | null;
  onUpdateSettings: (partial: Partial<UserAppSettings>) => Promise<void>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdateSettings }) => {
  if (!settings) return null;

  const handleRuleToggle = (ruleKey: keyof UserAppSettings['notificationRules']) => {
    onUpdateSettings({
      notificationRules: {
        ...settings.notificationRules,
        [ruleKey]: !settings.notificationRules[ruleKey],
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Settings size={26} color="var(--accent-cyan)" />
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Settings & Configuration</h3>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Configure local polling rates, notification rules, and privacy preferences
          </div>
        </div>
      </div>

      {/* Monitoring Settings */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} color="var(--accent-emerald)" /> Polling & Sampling Rates
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Connection Polling Interval (ms):
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%', padding: '8px 12px' }}
              min={1000}
              max={10000}
              step={500}
              value={settings.connectionPollingIntervalMs}
              onChange={(e) => onUpdateSettings({ connectionPollingIntervalMs: parseInt(e.target.value, 10) || 1500 })}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Interval for executing safe macOS lsof socket discovery (default 1500ms).
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              High Traffic Alert Threshold (MB/s):
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%', padding: '8px 12px' }}
              min={1}
              max={500}
              value={settings.highTrafficAlertThresholdMbps}
              onChange={(e) => onUpdateSettings({ highTrafficAlertThresholdMbps: parseInt(e.target.value, 10) || 10 })}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Threshold for triggering local throughput alerts (default 10 MB/s).
            </div>
          </div>
        </div>
      </div>

      {/* Notification Rules */}
      <div className="glass-panel" style={{ padding: '20px 24px' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} color="#fbbf24" /> Local Notification Rules
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={settings.notificationRules.newAiAgent}
              onChange={() => handleRuleToggle('newAiAgent')}
            />
            <span>Notify when a new <strong>AI Agent runtime</strong> (Ollama, LM Studio, Claude, Cursor, ChatGPT) is detected</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={settings.notificationRules.highTraffic}
              onChange={() => handleRuleToggle('highTraffic')}
            />
            <span>Notify when any process exceeds the <strong>High Traffic Threshold</strong> ({settings.highTrafficAlertThresholdMbps} MB/s)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={settings.notificationRules.newRemoteIp}
              onChange={() => handleRuleToggle('newRemoteIp')}
            />
            <span>Notify when a connection to a <strong>new remote IP address</strong> is observed</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={settings.notificationRules.blockedIpObserved}
              onChange={() => handleRuleToggle('blockedIpObserved')}
            />
            <span>Notify when traffic to an active <strong>PF firewall blocked IP</strong> is dropped</span>
          </label>
        </div>
      </div>

      {/* Local Privacy Statement */}
      <div className="glass-panel" style={{ padding: '20px 24px', borderLeft: '4px solid var(--accent-emerald)' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-emerald)' }}>
          <ShieldCheck size={20} /> 100% On-Device Local Privacy Guarantee
        </h4>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p>
            This application is engineered strictly as an on-device local monitor:
          </p>
          <ul style={{ paddingLeft: '20px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li><strong>Zero External Telemetry:</strong> No metrics, analytics, or process names are transmitted outside your Mac.</li>
            <li><strong>Loopback Binding:</strong> The HTTP and WebSocket backends bind exclusively to <code>127.0.0.1</code>.</li>
            <li><strong>No Cloud Dependencies:</strong> No remote IP reputation APIs or external geolocation services are queried.</li>
            <li><strong>Isolated Storage:</strong> SQLite history and PF rules files are stored locally in <code>~/.network-monitor/</code>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
