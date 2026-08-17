import process from 'node:process';
import {
  SystemDiagnosticsReport,
  SystemMonitorsStatus,
  APP_VERSION,
} from '@network-monitor/shared';
import { DatabaseService, databaseService } from './database.service.js';
import { HistoryService, historyService } from './history.service.js';
import { platformService } from '../platform/index.js';
import { LoggerService, logger } from './logger.service.js';
import { ProcessSupervisor, processSupervisor } from './process-supervisor.service.js';
import { formatBytes } from '../utils/formatters.js';

export class DiagnosticsService {
  private readonly dbService: DatabaseService;
  private readonly historyService: HistoryService;
  private readonly logger: LoggerService;
  private readonly supervisor: ProcessSupervisor;
  private isPaused = false;

  constructor(
    dbService: DatabaseService = databaseService,
    history: HistoryService = historyService,
    loggerService: LoggerService = logger,
    supervisor: ProcessSupervisor = processSupervisor
  ) {
    this.dbService = dbService;
    this.historyService = history;
    this.logger = loggerService;
    this.supervisor = supervisor;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public getMonitorsStatus(): SystemMonitorsStatus {
    const isConnDegraded = this.supervisor.getState('lsof') === 'degraded';
    const isTrafficUnavailable = this.supervisor.getState('nettop') === 'unavailable';

    return {
      backend: 'running',
      connections: this.isPaused ? 'paused' : isConnDegraded ? 'degraded' : 'running',
      traffic: this.isPaused ? 'paused' : isTrafficUnavailable ? 'unavailable' : 'running',
      history: this.isPaused ? 'paused' : this.historyService.isRecordingEnabled() ? 'running' : 'stopped',
      firewall: 'running',
      websocket: 'running',
      database: this.dbService.isAvailable() ? 'running' : 'degraded',
    };
  }

  public getDiagnosticReport(): SystemDiagnosticsReport {
    const mem = process.memoryUsage();
    const dbSize = this.dbService.getDatabaseSizeBytes();
    const fw = platformService.getFirewallProvider();
    const fwStatus = fw.getFirewallStatus();

    return {

      appVersion: APP_VERSION,
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,

      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMb: {
        rss: Math.round(mem.rss / (1024 * 1024)),
        heapTotal: Math.round(mem.heapTotal / (1024 * 1024)),
        heapUsed: Math.round(mem.heapUsed / (1024 * 1024)),
      },
      monitors: this.getMonitorsStatus(),
      configSummary: {
        serverHost: '127.0.0.1',
        serverPort: 3000,
        pollIntervalMs: 1500,
        historyRetentionDays: 7,
        logLevel: 'INFO',
        dryRunMode: fwStatus.dryRunMode,
      },
      database: {
        healthy: this.dbService.isAvailable(),
        sizeBytes: dbSize,
        sizeFormatted: formatBytes(dbSize),
        schemaVersion: this.dbService.getSchemaVersion(),
      },
      firewall: {
        anchorName: fwStatus.anchorName,
        isAnchorLoaded: fwStatus.isAnchorLoaded,
        blockedIpCount: fw.getBlockedIps().length,
        dryRunMode: fwStatus.dryRunMode,
      },
      recentErrors: this.logger.getRecentErrors(),
    };
  }
}

export const diagnosticsService = new DiagnosticsService();

