export type MonitorState = 'running' | 'degraded' | 'unavailable' | 'paused' | 'stopped';

export interface SystemMonitorsStatus {
  backend: MonitorState;
  connections: MonitorState;
  traffic: MonitorState;
  history: MonitorState;
  firewall: MonitorState;
  websocket: MonitorState;
  database: MonitorState;
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'error';
  uptimeSeconds: number;
  appVersion: string;
  isPaused: boolean;
  monitors: SystemMonitorsStatus;
}

export interface SystemDiagnosticsReport {
  appVersion: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  timestamp: string;
  uptimeSeconds: number;
  memoryUsageMb: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  monitors: SystemMonitorsStatus;
  configSummary: {
    serverHost: string;
    serverPort: number;
    pollIntervalMs: number;
    historyRetentionDays: number;
    logLevel: string;
    dryRunMode: boolean;
  };
  database: {
    healthy: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    schemaVersion: number;
  };
  firewall: {
    anchorName: string;
    isAnchorLoaded: boolean;
    blockedIpCount: number;
    dryRunMode: boolean;
  };
  recentErrors: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  appVersion: string;
  schemaVersion: number;
  databaseSizeBytes: number;
  settingsIncluded: boolean;
  filePath: string;
}

export type PlatformType = 'darwin' | 'win32' | 'linux' | string;

export interface PlatformInfo {
  platform: PlatformType;
  os: string;
  architecture: string;
  release?: string;
  supported: boolean;
}

