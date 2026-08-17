import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  BlockedIp,
  FirewallAuditEvent,
  FirewallStatus,
  PF_APPLICATION_ANCHOR,
  FIREWALL_EVENT_HISTORY_LIMIT,
} from '@network-monitor/shared';
import { validateIpAddress } from '../utils/ip-validator.js';
import { generateApplicationRules } from './pf-rule-generator.js';
import { IPfCommandRunner, pfCommandRunner } from './pf-command-runner.service.js';

export interface PfFirewallServiceOptions {
  dataDir?: string;
  commandRunner?: IPfCommandRunner;
}

export class PfFirewallService {
  private readonly runner: IPfCommandRunner;
  private readonly dataDir: string;
  private readonly stateFilePath: string;
  private readonly rulesFilePath: string;

  private blockedIps = new Map<string, BlockedIp>();
  private auditEvents: FirewallAuditEvent[] = [];
  private isAnchorLoaded = false;
  private lastError: string | null = null;

  constructor(options: PfFirewallServiceOptions = {}) {
    this.runner = options.commandRunner ?? pfCommandRunner;
    this.dataDir = options.dataDir ?? path.join(os.homedir(), '.network-monitor');
    this.stateFilePath = path.join(this.dataDir, 'blocked_ips.json');
    this.rulesFilePath = path.join(this.dataDir, 'pf_rules.conf');

    this.initialize();
  }

  /**
   * Initializes data directory, loads saved state, and applies initial anchor rules.
   */
  public async initialize(): Promise<void> {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      this.loadSavedState();
      await this.syncRulesToFirewall();
    } catch (err: unknown) {
      this.lastError = err instanceof Error ? err.message : 'Initialization error';
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[PfFirewallService] Initialization notice: ${this.lastError}`);
      }
    }
  }

  /**
   * Blocks a remote IP address safely in the application anchor.
   */
  public async blockIp(rawIp: string, comment?: string): Promise<{ success: boolean; blockedIp?: BlockedIp; error?: string; errorCode?: string }> {
    const validation = validateIpAddress(rawIp);

    if (!validation.isValid || !validation.normalizedIp || !validation.family) {
      return {
        success: false,
        error: validation.error || 'Invalid IP address',
        errorCode: 'INVALID_IP',
      };
    }

    const ip = validation.normalizedIp;

    if (validation.isProtected) {
      return {
        success: false,
        error: validation.protectionReason || 'Protected IP address cannot be blocked',
        errorCode: 'PROTECTED_IP',
      };
    }

    if (this.blockedIps.has(ip)) {
      return {
        success: false,
        error: `IP ${ip} is already blocked`,
        errorCode: 'IP_ALREADY_BLOCKED',
      };
    }

    const newBlockedIp: BlockedIp = {
      id: `ip-${ip.replace(/[^a-z0-9]/gi, '_')}`,
      ip,
      family: validation.family,
      blockedAt: new Date().toISOString(),
      source: 'manual',
      active: true,
      comment,
    };

    // Prepare candidate state
    const previousState = new Map(this.blockedIps);
    this.blockedIps.set(ip, newBlockedIp);

    try {
      await this.syncRulesToFirewall();
      this.saveStateToDisk();
      this.logAuditEvent('block_ip', ip, true);

      return { success: true, blockedIp: newBlockedIp };
    } catch (err: unknown) {
      // Rollback on failure
      this.blockedIps = previousState;
      const errMsg = err instanceof Error ? err.message : 'Failed to apply PF firewall rule';
      this.lastError = errMsg;
      this.logAuditEvent('block_ip', ip, false, 'PF_LOAD_FAILED', { error: errMsg });

      return {
        success: false,
        error: errMsg,
        errorCode: 'PF_LOAD_FAILED',
      };
    }
  }

  /**
   * Unblocks an IP address by regenerating anchor rules.
   */
  public async unblockIp(rawIp: string): Promise<{ success: boolean; unblockedIp?: string; error?: string; errorCode?: string }> {
    const validation = validateIpAddress(rawIp);

    if (!validation.isValid || !validation.normalizedIp) {
      return {
        success: false,
        error: validation.error || 'Invalid IP address',
        errorCode: 'INVALID_IP',
      };
    }

    const ip = validation.normalizedIp;

    if (!this.blockedIps.has(ip)) {
      return {
        success: false,
        error: `IP ${ip} is not currently blocked`,
        errorCode: 'BLOCK_NOT_FOUND',
      };
    }

    // Prepare candidate state
    const previousState = new Map(this.blockedIps);
    this.blockedIps.delete(ip);

    try {
      await this.syncRulesToFirewall();
      this.saveStateToDisk();
      this.logAuditEvent('unblock_ip', ip, true);

      return { success: true, unblockedIp: ip };
    } catch (err: unknown) {
      // Rollback on failure
      this.blockedIps = previousState;
      const errMsg = err instanceof Error ? err.message : 'Failed to reload PF firewall rules';
      this.lastError = errMsg;
      this.logAuditEvent('unblock_ip', ip, false, 'PF_LOAD_FAILED', { error: errMsg });

      return {
        success: false,
        error: errMsg,
        errorCode: 'PF_LOAD_FAILED',
      };
    }
  }

  /**
   * Generates rules file and loads into dedicated anchor.
   */
  private async syncRulesToFirewall(): Promise<void> {
    const activeIps = Array.from(this.blockedIps.values());
    const rulesContent = generateApplicationRules(activeIps);

    // Write rules file atomically
    fs.writeFileSync(this.rulesFilePath, rulesContent, 'utf-8');

    if (activeIps.length === 0) {
      // Clear anchor rules if empty
      const clearRes = await this.runner.clearAnchorRules(PF_APPLICATION_ANCHOR);
      if (clearRes.exitCode !== 0 && clearRes.stderr) {
        throw new Error(`Failed to clear PF anchor: ${clearRes.stderr}`);
      }
      this.isAnchorLoaded = true;
      this.lastError = null;
      return;
    }

    // Load anchor rules
    const loadRes = await this.runner.loadAnchorRules(this.rulesFilePath, PF_APPLICATION_ANCHOR);
    if (loadRes.exitCode !== 0) {
      throw new Error(`pfctl failed to load anchor rules: ${loadRes.stderr || 'Unknown pfctl error'}`);
    }

    this.isAnchorLoaded = true;
    this.lastError = null;
  }

  /**
   * Clears only application anchor rules (internal safe recovery).
   */
  public async clearApplicationRules(): Promise<{ success: boolean; message: string }> {
    this.blockedIps.clear();
    this.saveStateToDisk();

    try {
      await this.runner.clearAnchorRules(PF_APPLICATION_ANCHOR);
      this.isAnchorLoaded = true;
      return { success: true, message: `Application anchor "${PF_APPLICATION_ANCHOR}" rules cleared.` };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to clear anchor';
      return { success: false, message: errMsg };
    }
  }

  /**
   * Returns all currently blocked IPs.
   */
  public getBlockedIps(): BlockedIp[] {
    return Array.from(this.blockedIps.values());
  }

  /**
   * Checks if a specific IP address is blocked.
   */
  public isIpBlocked(ip: string): boolean {
    const val = validateIpAddress(ip);
    if (!val.isValid || !val.normalizedIp) return false;
    return this.blockedIps.has(val.normalizedIp);
  }

  /**
   * Returns current firewall operational status.
   */
  public getFirewallStatus(): FirewallStatus {
    return {
      isAvailable: true,
      isAnchorLoaded: this.isAnchorLoaded,
      anchorName: PF_APPLICATION_ANCHOR,
      totalBlocked: this.blockedIps.size,
      lastError: this.lastError,
      dryRunMode: this.runner.isDryRun(),
    };
  }

  /**
   * Returns recent firewall audit log.
   */
  public getAuditEvents(): FirewallAuditEvent[] {
    return [...this.auditEvents];
  }

  private loadSavedState(): void {
    if (!fs.existsSync(this.stateFilePath)) return;

    try {
      const content = fs.readFileSync(this.stateFilePath, 'utf-8');
      const parsed = JSON.parse(content) as BlockedIp[];
      if (Array.isArray(parsed)) {
        this.blockedIps.clear();
        for (const item of parsed) {
          const val = validateIpAddress(item.ip);
          if (val.isValid && val.normalizedIp && !val.isProtected) {
            this.blockedIps.set(val.normalizedIp, item);
          }
        }
      }
    } catch (err) {
      console.warn('[PfFirewallService] Failed to load saved blocked IPs JSON:', err);
    }
  }

  private saveStateToDisk(): void {
    try {
      const data = Array.from(this.blockedIps.values());
      const tempPath = `${this.stateFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.stateFilePath);
    } catch (err) {
      console.error('[PfFirewallService] Error saving blocked IPs state:', err);
    }
  }

  private logAuditEvent(
    action: 'block_ip' | 'unblock_ip',
    ip: string,
    success: boolean,
    errorCode?: string,
    details?: Record<string, unknown>
  ): void {
    const event: FirewallAuditEvent = {
      id: `fw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      ip,
      success,
      errorCode,
      details,
    };

    this.auditEvents.unshift(event);
    if (this.auditEvents.length > FIREWALL_EVENT_HISTORY_LIMIT) {
      this.auditEvents.pop();
    }
  }
}

export const pfFirewallService = new PfFirewallService();
