import {
  PackageActivityEvent,
  PackageManagerName,
  PackageActionType,
  SecuritySeverity,
} from '@network-monitor/shared';
import { securityTimelineService, SecurityTimelineService } from '../timeline/security-timeline.service.js';

export class PackageMonitorService {
  private readonly timeline: SecurityTimelineService;
  private recentEvents: PackageActivityEvent[] = [];

  constructor(timeline: SecurityTimelineService = securityTimelineService) {
    this.timeline = timeline;
  }

  /**
   * Evaluates a command line for package manager activity.
   */
  public inspectCommandLine(
    pid: number,
    processName: string,
    commandLine?: string,
    agentId?: string
  ): PackageActivityEvent | null {
    if (!commandLine) return null;
    const cmd = commandLine.toLowerCase();

    let packageManager: PackageManagerName | null = null;
    let action: PackageActionType = 'install';
    let severity: SecuritySeverity = 'INFO';

    if (cmd.includes('npm install') || cmd.includes('npm i ') || cmd.includes('npm add')) {
      packageManager = 'npm';
      action = 'install';
    } else if (cmd.includes('pip install') || cmd.includes('pip3 install')) {
      packageManager = 'pip';
      action = 'install';
    } else if (cmd.includes('cargo add') || cmd.includes('cargo install') || cmd.includes('cargo build')) {
      packageManager = 'cargo';
      action = 'install';
    } else if (cmd.includes('go get') || cmd.includes('go install')) {
      packageManager = 'go';
      action = 'install';
    } else if (cmd.includes('brew install')) {
      packageManager = 'brew';
      action = 'install';
    }

    if (!packageManager) return null;

    if (cmd.includes('--ignore-scripts') || cmd.includes('--no-scripts')) {
      severity = 'INFO';
    } else if (cmd.includes('postinstall') || cmd.includes('preinstall')) {
      severity = 'MEDIUM';
      action = 'postinstall';
    }

    const event: PackageActivityEvent = {
      id: `pkg-evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      agentId,
      pid,
      processName,
      packageManager,
      action,
      timestamp: new Date().toISOString(),
      severity,
      description: `Package activity observed: ${packageManager} ${action} via ${processName} (PID ${pid})`,
    };

    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 200) {
      this.recentEvents = this.recentEvents.slice(0, 200);
    }

    this.timeline.recordEvent({
      type: 'PACKAGE_INSTALLED',
      agentId,
      agentName: agentId,
      pid,
      processName,
      severity,
      riskDelta: severity === 'MEDIUM' ? 10 : 2,
      description: event.description,
      metadata: { packageManager, action, commandLine: commandLine.substring(0, 100) },
    });

    return event;
  }

  /**
   * Retrieves recent package activity events.
   */
  public getRecentEvents(limit = 50): PackageActivityEvent[] {
    return this.recentEvents.slice(0, limit);
  }
}

export const packageMonitorService = new PackageMonitorService();
