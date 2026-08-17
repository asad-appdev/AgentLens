import {
  PreparedAction,
  NaturalLanguageFilter,
  WatchRule,
} from '@network-monitor/shared';
import { investigationService, InvestigationService } from '../intelligence/investigation/investigation.service.js';

export class ActionPreparationService {
  private readonly actions = new Map<string, PreparedAction>();
  private readonly investigations: InvestigationService;

  constructor(investigations: InvestigationService = investigationService) {
    this.investigations = investigations;
  }

  public getPendingActions(): PreparedAction[] {
    return Array.from(this.actions.values()).filter((a) => a.status === 'PENDING');
  }

  public getAction(id: string): PreparedAction | undefined {
    return this.actions.get(id);
  }

  public prepareBlockIp(ip: string, reason: string, processName?: string): PreparedAction {
    const id = `act-block-${Date.now()}`;
    const action: PreparedAction = {
      id,
      actionType: 'PREPARE_BLOCK_IP',
      title: `Block Remote IP: ${ip}`,
      target: ip,
      reason,
      impactDescription: `Dropping all future inbound and outbound packets to ${ip} across all macOS processes via dedicated PF anchor com.networkmonitor.app.`,
      payload: { ip, processName },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.actions.set(id, action);
    return action;
  }

  public prepareKillProcess(
    pid: number,
    signal: 'SIGTERM' | 'SIGKILL',
    reason: string,
    processName?: string
  ): PreparedAction {
    const id = `act-kill-${Date.now()}`;
    const action: PreparedAction = {
      id,
      actionType: 'PREPARE_KILL_PROCESS',
      title: `Terminate Process: ${processName || 'PID ' + pid} (${signal})`,
      target: String(pid),
      reason,
      impactDescription: `Sending ${signal} signal to terminate process PID ${pid} (${processName || 'Unknown'}). Open sockets and child processes will be closed.`,
      payload: { pid, signal, processName },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.actions.set(id, action);
    return action;
  }

  public prepareCreateInvestigation(
    title: string,
    description: string,
    pinnedItems: Array<{ type: any; targetId: string; title: string }> = []
  ): PreparedAction {
    const id = `act-inv-${Date.now()}`;
    const action: PreparedAction = {
      id,
      actionType: 'CREATE_INVESTIGATION',
      title: `Create Investigation: ${title}`,
      target: title,
      reason: 'AI Analyst synthesized automated investigation workspace with relevant observability targets.',
      impactDescription: 'Initializes a local, non-destructive investigation workspace and pins relevant processes and endpoints.',
      payload: { title, description, pinnedItems },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.actions.set(id, action);
    return action;
  }

  public prepareAddWatchRule(rule: Partial<WatchRule>): PreparedAction {
    const id = `act-watch-${Date.now()}`;
    const action: PreparedAction = {
      id,
      actionType: 'ADD_WATCH_RULE',
      title: `Add Watch Rule: ${rule.name || 'Automated Monitor'}`,
      target: rule.targetName || 'All',
      reason: `Automated rule to trigger ${rule.action || 'NOTIFY'} when ${rule.triggerType || 'event'} occurs.`,
      impactDescription: 'Adds a non-destructive monitoring watch trigger for live evaluation.',
      payload: { ...rule },
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.actions.set(id, action);
    return action;
  }

  /**
   * Parses natural language query into structured filter object.
   */
  public parseNaturalLanguageFilter(query: string): NaturalLanguageFilter {
    const q = query.toLowerCase();
    const filter: NaturalLanguageFilter = {
      description: query,
    };

    if (q.includes('ai') || q.includes('ollama') || q.includes('claude') || q.includes('lm studio')) {
      filter.isAiOnly = true;
    }

    // Check throughput (e.g. 1 mb/s, 100 kb/s)
    if (q.includes('1 mb') || q.includes('1mb') || q.includes('1 mb/s')) {
      filter.minThroughputBytesPerSec = 1048576;
    } else if (q.includes('100 kb') || q.includes('100kb')) {
      filter.minThroughputBytesPerSec = 102400;
    }

    // Check remote IPs count
    if (q.includes('10') && (q.includes('ips') || q.includes('hosts') || q.includes('endpoints'))) {
      filter.minRemoteIpsCount = 10;
    }

    if (q.includes('tcp')) {
      filter.protocol = 'TCP';
    } else if (q.includes('udp')) {
      filter.protocol = 'UDP';
    }

    if (q.includes('established')) {
      filter.state = 'ESTABLISHED';
    } else if (q.includes('listen') || q.includes('listening')) {
      filter.state = 'LISTEN';
    }

    return filter;
  }

  public dismissAction(id: string): boolean {
    const action = this.actions.get(id);
    if (!action) return false;
    action.status = 'DISMISSED';
    return true;
  }

  public confirmAction(id: string): { success: boolean; result?: any; error?: string } {
    const action = this.actions.get(id);
    if (!action) return { success: false, error: 'Action not found' };

    action.status = 'CONFIRMED';

    if (action.actionType === 'CREATE_INVESTIGATION') {
      const payload = action.payload as { title: string; description: string; pinnedItems?: any[] };
      const ws = this.investigations.createInvestigation(payload.title, payload.description);
      if (payload.pinnedItems && Array.isArray(payload.pinnedItems)) {
        for (const item of payload.pinnedItems) {
          this.investigations.addItem(ws.id, item.type, item.targetId, item.title);
        }
      }
      return { success: true, result: ws };
    }

    return { success: true, result: action.payload };
  }
}

export const actionPreparationService = new ActionPreparationService();
