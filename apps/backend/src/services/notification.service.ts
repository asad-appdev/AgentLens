import {
  LocalNotificationEvent,
  EventSeverity,
  NotificationEventType,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
} from '@network-monitor/shared';
import { SettingsService, settingsService } from './settings.service.js';

export class NotificationService {
  private readonly events: LocalNotificationEvent[] = [];
  private readonly maxEvents = 200;
  private readonly cooldowns = new Map<string, number>(); // key -> lastTriggerEpochMs
  private readonly seenAiPids = new Set<number>();
  private readonly seenRemoteIps = new Set<string>();
  private readonly settings: SettingsService;

  constructor(settings: SettingsService = settingsService) {
    this.settings = settings;
  }

  public getEvents(limit = 100): LocalNotificationEvent[] {
    return this.events.slice(0, limit);
  }

  public getUnreadCount(): number {
    return this.events.filter((e) => !e.read).length;
  }

  public markAllRead(): void {
    for (const e of this.events) {
      e.read = true;
    }
  }

  public clearEvents(): void {
    this.events.length = 0;
  }

  public pushEvent(
    type: NotificationEventType,
    severity: EventSeverity,
    title: string,
    message: string,
    meta?: { pid?: number; processName?: string; remoteIp?: string; metadata?: Record<string, unknown> }
  ): boolean {
    const cooldownKey = `${type}:${meta?.pid || meta?.processName || meta?.remoteIp || title}`;
    const now = Date.now();
    const lastTrigger = this.cooldowns.get(cooldownKey) || 0;

    if (now - lastTrigger < DEFAULT_NOTIFICATION_COOLDOWN_SECONDS * 1000) {
      return false; // Cooldown active, deduplicate
    }

    this.cooldowns.set(cooldownKey, now);

    const event: LocalNotificationEvent = {
      id: `evt-${now}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date(now).toISOString(),
      type,
      severity,
      title,
      message,
      pid: meta?.pid,
      processName: meta?.processName,
      remoteIp: meta?.remoteIp,
      read: false,
      metadata: meta?.metadata,
    };

    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    return true;
  }

  /**
   * Evaluates active network connections and traffic for rule triggers.
   */
  public evaluateRules(
    connections: Array<{ pid: number; processName: string; remoteAddress: string | null; isAiAgent?: boolean; aiAgentName?: string }>,
    processTrafficList: Array<{ pid: number; processName: string; bytesInPerSecond: number; bytesOutPerSecond: number }>
  ): void {
    const rules = this.settings.getSettings().notificationRules;
    const highTrafficThresholdBytes = this.settings.getSettings().highTrafficAlertThresholdMbps * 1024 * 1024;

    // 1. Check New AI Agent
    if (rules.newAiAgent) {
      for (const c of connections) {
        if (c.isAiAgent && !this.seenAiPids.has(c.pid)) {
          this.seenAiPids.add(c.pid);
          this.pushEvent(
            'new_ai_agent',
            'INFO',
            'AI Agent Runtime Detected',
            `Process "${c.processName}" (PID ${c.pid}) was identified as an active AI agent (${c.aiAgentName || 'Generic'}).`,
            { pid: c.pid, processName: c.processName }
          );
        }
      }
    }

    // 2. Check High Traffic
    if (rules.highTraffic) {
      for (const t of processTrafficList) {
        const totalRate = t.bytesInPerSecond + t.bytesOutPerSecond;
        if (totalRate >= highTrafficThresholdBytes) {
          const mbps = (totalRate / (1024 * 1024)).toFixed(1);
          this.pushEvent(
            'high_traffic',
            'WARNING',
            'High Network Throughput Observed',
            `Process "${t.processName}" (PID ${t.pid}) is transferring data at ${mbps} MB/s.`,
            { pid: t.pid, processName: t.processName }
          );
        }
      }
    }

    // 3. Check New Remote IP
    if (rules.newRemoteIp) {
      for (const c of connections) {
        if (c.remoteAddress && c.remoteAddress !== '*' && c.remoteAddress !== '127.0.0.1' && c.remoteAddress !== '::1') {
          if (!this.seenRemoteIps.has(c.remoteAddress)) {
            this.seenRemoteIps.add(c.remoteAddress);
            this.pushEvent(
              'new_remote_ip',
              'INFO',
              'New Remote Endpoint Contacted',
              `Process "${c.processName}" connected to new remote IP ${c.remoteAddress}.`,
              { pid: c.pid, processName: c.processName, remoteIp: c.remoteAddress }
            );
          }
        }
      }
    }
  }
}

export const notificationService = new NotificationService(settingsService);
