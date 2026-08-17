export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 43121;
export const DEFAULT_WS_HEARTBEAT_INTERVAL_MS = 15000;
export const DEFAULT_NETWORK_POLL_INTERVAL_MS = 1500;
export const DEFAULT_TRAFFIC_UPDATE_INTERVAL_MS = 1000;
export const DEFAULT_TRAFFIC_ACTIVE_THRESHOLD_BYTES_PER_SECOND = 1024; // 1 KB/s threshold

// History & Aggregation Defaults
export const DEFAULT_HISTORY_AGGREGATION_INTERVAL_MS = 5000; // 5 seconds
export const DEFAULT_HISTORY_RETENTION_DAYS = 7;
export const DEFAULT_MAX_HISTORY_SIZE_MB = 500;
export const MAX_HISTORY_QUERY_LIMIT = 1000;

export const APP_NAME = 'AgentLens';

// Dedicated PF Anchor Name for application-owned rules (macOS)
export const PF_APPLICATION_ANCHOR = 'com.agentlens.app';
// Dedicated Windows Firewall Rule Prefix for application-owned rules (Windows)
export const WINDOWS_FIREWALL_RULE_PREFIX = 'PortScope_Block_';
export const WINDOWS_FIREWALL_AGENTLENS_PREFIX = 'AgentLens_Block_';
export const FIREWALL_EVENT_HISTORY_LIMIT = 500;

export const APP_VERSION = '1.0.0';
export const DEFAULT_HIGH_TRAFFIC_ALERT_MBPS = 10;
export const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 60;

export const API_ROUTES = {
  HEALTH: '/api/health',
  READY: '/api/ready',
  DIAGNOSTICS: '/api/diagnostics',
  DIAGNOSTICS_EXPORT: '/api/diagnostics/export',
  SYSTEM_PLATFORM: '/api/system/platform',
  SYSTEM_PAUSE: '/api/system/pause',
  SYSTEM_RESUME: '/api/system/resume',
  SYSTEM_BACKUP: '/api/system/backup',
  SYSTEM_RESTORE: '/api/system/restore',
  SYSTEM_STATUS: '/api/system/status',
  CONNECTIONS: '/api/connections',
  TRAFFIC: '/api/traffic',
  LOCAL_SERVERS: '/api/local-servers',
  KILL_PORT: '/api/kill-port',
  KILL_PROCESSES: '/api/kill-processes',
  FIREWALL_BLOCK: '/api/firewall/block-ip',
  FIREWALL_UNBLOCK: '/api/firewall/unblock-ip',
  FIREWALL_BLOCKED_IPS: '/api/firewall/blocked-ips',
  FIREWALL_STATUS: '/api/firewall/status',
  FIREWALL_EVENTS: '/api/firewall/events',
  FIREWALL_REPAIR: '/api/firewall/repair',
  FIREWALL_DISABLE: '/api/firewall/disable',
  HISTORY_SUMMARY: '/api/history/summary',
  HISTORY_TIMELINE: '/api/history/timeline',
  HISTORY_CONNECTIONS: '/api/history/connections',
  HISTORY_PROCESSES: '/api/history/processes',
  HISTORY_PROCESS_DETAIL: '/api/history/process-detail',
  HISTORY_TOP_IPS: '/api/history/top-ips',
  HISTORY_STATUS: '/api/history/status',
  HISTORY_TOGGLE: '/api/history/toggle-recording',
  HISTORY_CLEAR: '/api/history/clear',
  EXPORT_SNAPSHOT: '/api/export/snapshot',
  EXPORT_HISTORY: '/api/export/history',
  INTELLIGENCE_PROCESS_INSPECT: '/api/intelligence/process',
  INTELLIGENCE_PROCESS_TREE: '/api/intelligence/process-tree',
  INTELLIGENCE_CONNECTION_INSPECT: '/api/intelligence/connection',
  INTELLIGENCE_REMOTE_IP_INSPECT: '/api/intelligence/remote-ip',
  INTELLIGENCE_EVENTS: '/api/intelligence/events',
  INTELLIGENCE_SETTINGS: '/api/intelligence/settings',
  SYSTEM: '/api/system',
} as const;


export const WS_CHANNELS = {
  CONNECTIONS: 'connections',
  TRAFFIC: 'traffic',
  FIREWALL: 'firewall',
  HISTORY: 'history',
  NOTIFICATIONS: 'notifications',
  STATUS: 'status',
} as const;
