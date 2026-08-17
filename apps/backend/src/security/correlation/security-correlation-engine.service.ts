import {
  SecurityAlert,
  SensitiveFileAccess,
} from '@network-monitor/shared';
import { securityAlertsService, SecurityAlertsService } from '../alerts/security-alerts.service.js';

import { securityTimelineService, SecurityTimelineService } from '../timeline/security-timeline.service.js';


interface CorrelatedWindow {
  agentId: string;
  pid: number;
  processName: string;
  sensitiveFiles: SensitiveFileAccess[];
  newDestinations: Array<{ host: string; port: number; bytesOut: number; timestamp: string }>;
  spawnedCommands: Array<{ command: string; childPid: number; timestamp: string }>;
  packageEvents: Array<{ packageManager: string; action: string; timestamp: string }>;
  persistenceModifications: Array<{ targetPath: string; timestamp: string }>;
  lastActivity: number;
}

export class SecurityCorrelationEngine {
  private readonly alerts: SecurityAlertsService;
  private readonly timeline: SecurityTimelineService;
  private windows = new Map<number, CorrelatedWindow>(); // PID -> Window
  private windowDurationMs = 10 * 60 * 1000; // 10 minutes sliding correlation window

  constructor(
    alerts: SecurityAlertsService = securityAlertsService,
    timeline: SecurityTimelineService = securityTimelineService
  ) {
    this.alerts = alerts;
    this.timeline = timeline;
  }


  private getOrCreateWindow(pid: number, agentId: string, processName: string): CorrelatedWindow {
    let win = this.windows.get(pid);
    const now = Date.now();

    if (!win || now - win.lastActivity > this.windowDurationMs) {
      win = {
        agentId,
        pid,
        processName,
        sensitiveFiles: [],
        newDestinations: [],
        spawnedCommands: [],
        packageEvents: [],
        persistenceModifications: [],
        lastActivity: now,
      };
      this.windows.set(pid, win);
    } else {
      win.lastActivity = now;
    }
    return win;
  }

  /**
   * Correlates sensitive file access events.
   */
  public handleSensitiveFileAccess(access: SensitiveFileAccess): SecurityAlert | null {
    const win = this.getOrCreateWindow(access.pid, access.accessedBy, access.processName);
    win.sensitiveFiles.push(access);

    // Record timeline event
    this.timeline.recordEvent({
      type: 'FILE_ACCESS',
      agentId: access.accessedBy,
      agentName: access.accessedBy,
      pid: access.pid,
      processName: access.processName,
      severity: access.sensitivity === 'critical' ? 'HIGH' : 'MEDIUM',
      riskDelta: access.sensitivity === 'critical' ? 25 : 15,
      description: `Accessed sensitive ${access.category} resource '${access.path}' (safe metadata only)`,
      metadata: { path: access.path, category: access.category, sensitivity: access.sensitivity },
    });

    // Check if new destinations or outbound traffic already occurred in this window
    return this.evaluateRules(win);
  }

  /**
   * Correlates outbound network destination connection.
   */
  public handleOutboundDestination(
    pid: number,
    agentId: string,
    processName: string,
    host: string,
    port: number,
    bytesOut: number,
    isUnseen = false
  ): SecurityAlert | null {
    const win = this.getOrCreateWindow(pid, agentId, processName);

    if (isUnseen || bytesOut > 1024 * 1024) {
      win.newDestinations.push({ host, port, bytesOut, timestamp: new Date().toISOString() });

      this.timeline.recordEvent({
        type: 'NETWORK_CONNECTION',
        agentId,
        agentName: agentId,
        pid,
        processName,
        severity: isUnseen ? 'MEDIUM' : 'INFO',
        riskDelta: isUnseen ? 15 : 5,
        description: `Outbound connection to ${host}:${port} (${(bytesOut / 1024).toFixed(1)} KB)${isUnseen ? ' [Unseen Destination]' : ''}`,
        metadata: { host, port, bytesOut, isUnseen },
      });

      return this.evaluateRules(win);
    }

    return null;
  }

  /**
   * Correlates unusual child process executions.
   */
  public handleSpawnedCommand(
    pid: number,
    agentId: string,
    processName: string,
    command: string,
    childPid: number
  ): SecurityAlert | null {
    const win = this.getOrCreateWindow(pid, agentId, processName);
    win.spawnedCommands.push({ command, childPid, timestamp: new Date().toISOString() });

    this.timeline.recordEvent({
      type: 'CHILD_PROCESS_CREATED',
      agentId,
      agentName: agentId,
      pid: childPid,
      processName,
      severity: 'MEDIUM',
      riskDelta: 10,
      description: `Spawned child command line: ${command.substring(0, 80)}`,
      metadata: { command, childPid },
    });

    return this.evaluateRules(win);
  }

  /**
   * Correlates persistence modification events.
   */
  public handlePersistenceModification(
    pid: number,
    agentId: string,
    processName: string,
    targetPath: string
  ): SecurityAlert | null {
    const win = this.getOrCreateWindow(pid, agentId, processName);
    win.persistenceModifications.push({ targetPath, timestamp: new Date().toISOString() });

    this.timeline.recordEvent({
      type: 'PERSISTENCE_CHANGED',
      agentId,
      agentName: agentId,
      pid,
      processName,
      severity: 'HIGH',
      riskDelta: 30,
      description: `Modified system persistence configuration at '${targetPath}'`,
      metadata: { targetPath },
    });

    return this.evaluateRules(win);
  }

  /**
   * Evaluates deterministic multi-signal correlation rules across active window.
   */
  private evaluateRules(win: CorrelatedWindow): SecurityAlert | null {
    // 1. DATA EXPOSURE CORRELATION: [Sensitive File Access] + [New External Destination or Outbound Burst]
    if (win.sensitiveFiles.length > 0 && win.newDestinations.length > 0) {
      const topFile = win.sensitiveFiles[0];
      const topDest = win.newDestinations[0];

      if (topFile && topDest) {
        const evidence = [
          `1. Sensitive file accessed: '${topFile.path}' (${topFile.category})`,
          `2. Outbound destination observed: ${topDest.host}:${topDest.port}`,
          `3. Outbound data transfer volume: ${(topDest.bytesOut / 1024).toFixed(1)} KB`,
        ];

        return this.alerts.createAlert({
          severity: 'HIGH',
          title: 'Potential Sensitive-Data Exposure',
          category: 'data_exposure',
          agentId: win.agentId,
          agentName: win.agentId,
          pid: win.pid,
          processName: win.processName,
          confidence: 0.88,
          evidence,
          whySuspicious: `The agent accessed sensitive file '${topFile.path}' and shortly afterward established an outbound connection to destination '${topDest.host}:${topDest.port}'.`,
          whatIsUnknown: 'Agent Lens cannot confirm whether the contents of the sensitive file were transmitted over the encrypted connection.',
          recommendation: 'Verify if this external destination is a legitimate endpoint before permitting outbound traffic or terminating the agent process.',
          actions: [
            {
              type: 'INVESTIGATE',
              label: 'Investigate Evidence',
              targetId: win.agentId,
              requiresConfirmation: false,
            },
            {
              type: 'BLOCK_DESTINATION',
              label: `Block IP ${topDest.host}`,
              targetId: topDest.host,
              requiresConfirmation: true,
              destructive: true,
            },
            {
              type: 'KILL_AGENT',
              label: `Kill Process (PID ${win.pid})`,
              targetId: String(win.pid),
              requiresConfirmation: true,
              destructive: true,
            },
            {
              type: 'DISMISS',
              label: 'Dismiss',
              targetId: 'dismiss',
              requiresConfirmation: false,
            },
          ],
        });
      }
    }

    // 2. PERSISTENCE MODIFICATION CORRELATION
    if (win.persistenceModifications.length > 0) {
      const topMod = win.persistenceModifications[0];
      if (topMod) {
        return this.alerts.createAlert({
          severity: 'HIGH',
          title: 'System Persistence Modification Detected',
          category: 'persistence',
          agentId: win.agentId,
          agentName: win.agentId,
          pid: win.pid,
          processName: win.processName,
          confidence: 0.92,
          evidence: [
            `Target path modified: '${topMod.targetPath}'`,
            `Triggered by process: ${win.processName} (PID ${win.pid})`,
          ],
          whySuspicious: 'Process wrote to startup or background service paths that enable automatic execution on boot.',
          whatIsUnknown: 'Whether this persistence registration was explicitly requested by user developer tooling configuration.',
          recommendation: 'Review startup configuration entry and remove if not intentionally configured.',
          actions: [
            { type: 'INVESTIGATE', label: 'Investigate', targetId: win.agentId, requiresConfirmation: false },
            { type: 'KILL_AGENT', label: `Kill Process (PID ${win.pid})`, targetId: String(win.pid), requiresConfirmation: true, destructive: true },
            { type: 'DISMISS', label: 'Dismiss', targetId: 'dismiss', requiresConfirmation: false },
          ],
        });
      }
    }

    return null;
  }

}

export const securityCorrelationEngine = new SecurityCorrelationEngine();
