import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WatchRule, WatchTriggerType, WatchActionType } from '@network-monitor/shared';
import { notificationService, NotificationService } from '../services/notification.service.js';
import { investigationService, InvestigationService } from '../intelligence/investigation/investigation.service.js';

export class WatchRulesService {
  private readonly rules = new Map<string, WatchRule>();
  private readonly storagePath: string;
  private readonly notifications: NotificationService;
  private readonly investigations: InvestigationService;

  constructor(
    notifications: NotificationService = notificationService,
    investigations: InvestigationService = investigationService,
    storageDir?: string
  ) {
    this.notifications = notifications;
    this.investigations = investigations;
    const baseDir = storageDir || path.join(os.homedir(), '.network-monitor');
    this.storagePath = path.join(baseDir, 'watch-rules.json');

    this.loadRules();

    // Default sample watch rules if none exist
    if (this.rules.size === 0) {
      this.createRule({
        name: 'Claude Code Endpoint Watch',
        targetType: 'agent',
        targetName: 'Claude Code',
        triggerType: 'NEW_ENDPOINT',
        action: 'NOTIFY',
      });
      this.createRule({
        name: 'Ollama High Bandwidth Watch',
        targetType: 'agent',
        targetName: 'Ollama',
        triggerType: 'HIGH_THROUGHPUT',
        threshold: 10485760, // 10 MB/s
        action: 'NOTIFY',
      });
    }
  }

  private loadRules(): void {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const list = JSON.parse(raw) as WatchRule[];
        for (const r of list) {
          this.rules.set(r.id, r);
        }
      }
    } catch {
      // ignore
    }
  }

  private saveRules(): void {
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(Array.from(this.rules.values()), null, 2), 'utf8');
    } catch {
      // ignore
    }
  }

  public listRules(): WatchRule[] {
    return Array.from(this.rules.values());
  }

  public createRule(data: {
    name: string;
    targetType: 'agent' | 'process';
    targetName: string;
    triggerType: WatchTriggerType;
    threshold?: number;
    action: WatchActionType;
  }): WatchRule {
    const id = `watch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const rule: WatchRule = {
      id,
      name: data.name.trim(),
      targetType: data.targetType,
      targetName: data.targetName.trim(),
      triggerType: data.triggerType,
      threshold: data.threshold,
      action: data.action,
      isEnabled: true,
      createdAt: new Date().toISOString(),
      triggerCount: 0,
    };

    this.rules.set(id, rule);
    this.saveRules();
    return rule;
  }

  public deleteRule(id: string): boolean {
    const deleted = this.rules.delete(id);
    if (deleted) this.saveRules();
    return deleted;
  }

  public toggleRule(id: string, isEnabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    rule.isEnabled = isEnabled;
    this.saveRules();
    return true;
  }

  /**
   * Evaluates watch rules against live observation events.
   */
  public evaluateEvent(
    eventType: 'NEW_ENDPOINT' | 'HIGH_THROUGHPUT' | 'SOCKET_COUNT',
    targetName: string,
    value?: number,
    metadata?: Record<string, unknown>
  ): void {
    for (const rule of this.rules.values()) {
      if (!rule.isEnabled) continue;
      if (rule.triggerType !== eventType) continue;

      const matchesTarget =
        rule.targetName.toLowerCase() === 'all' ||
        targetName.toLowerCase().includes(rule.targetName.toLowerCase()) ||
        rule.targetName.toLowerCase().includes(targetName.toLowerCase());

      if (!matchesTarget) continue;

      if (rule.threshold && value !== undefined && value < rule.threshold) {
        continue;
      }

      // Trigger action
      rule.triggerCount += 1;
      rule.lastTriggered = new Date().toISOString();
      this.saveRules();

      if (rule.action === 'NOTIFY') {
        this.notifications.pushEvent(
          'high_traffic',
          'WARNING',
          `Watch Trigger: ${rule.name}`,
          `Observation for ${targetName} matched watch rule "${rule.name}".`,
          { processName: targetName, metadata }
        );
      } else if (rule.action === 'CREATE_INVESTIGATION') {
        this.investigations.createInvestigation(
          `Automated Investigation: ${rule.name}`,
          `Created automatically by watch trigger for ${targetName} (${new Date().toLocaleString()}).`
        );
      }
    }
  }
}

export const watchRulesService = new WatchRulesService();
