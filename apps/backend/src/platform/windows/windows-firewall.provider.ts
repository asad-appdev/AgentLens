import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  BlockedIp,
  FirewallAuditEvent,
  FirewallStatus,
} from '@network-monitor/shared';
import {
  WINDOWS_FIREWALL_RULE_PREFIX,
  FIREWALL_EVENT_HISTORY_LIMIT,
} from '@network-monitor/shared';
import type { IPlatformFirewallProvider, BlockIpResult, UnblockIpResult } from '../interfaces/firewall-provider.interface.js';
import { CommandRunnerService, commandRunner } from '../../services/command-runner.service.js';
import { validateIpAddress } from '../../utils/ip-validator.js';

export interface WindowsFirewallOptions {
  dataDir?: string;
  runner?: CommandRunnerService;
}

export class WindowsFirewallProvider implements IPlatformFirewallProvider {
  private readonly runner: CommandRunnerService;
  private readonly dataDir: string;
  private readonly stateFilePath: string;

  private blockedIps = new Map<string, BlockedIp>();
  private auditEvents: FirewallAuditEvent[] = [];
  private lastError: string | null = null;

  constructor(options: WindowsFirewallOptions = {}) {
    this.runner = options.runner ?? commandRunner;
    this.dataDir = options.dataDir ?? path.join(os.homedir(), '.network-monitor');
    this.stateFilePath = path.join(this.dataDir, 'windows_blocked_ips.json');

    this.initialize();
  }

  public initialize(): void {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      this.loadSavedState();
    } catch (err: unknown) {
      this.lastError = err instanceof Error ? err.message : 'Initialization error';
    }
  }

  public getRuleNameForIp(ip: string): string {
    const sanitized = ip.replace(/[^a-zA-Z0-9]/g, '_');
    return `${WINDOWS_FIREWALL_RULE_PREFIX}${sanitized}`;
  }

  public async blockIp(rawIp: string, comment?: string): Promise<BlockIpResult> {
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
        error: `IP ${ip} is already blocked in Windows Defender Firewall`,
        errorCode: 'IP_ALREADY_BLOCKED',
      };
    }

    const ruleName = this.getRuleNameForIp(ip);

    const newBlockedIp: BlockedIp = {
      id: `win-ip-${ip.replace(/[^a-z0-9]/gi, '_')}`,
      ip,
      family: validation.family,
      blockedAt: new Date().toISOString(),
      source: 'manual',
      active: true,
      comment,
    };

    // Execute PowerShell New-NetFirewallRule safely with strict parameters
    try {
      const psResult = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `New-NetFirewallRule -DisplayName "${ruleName}" -Name "${ruleName}" -Direction Outbound -Action Block -RemoteAddress "${ip}" -Enabled True`,
      ]);

      const stderr = (psResult.stderr || '').toLowerCase();
      if (psResult.exitCode !== 0 && (stderr.includes('access is denied') || stderr.includes('permission denied') || stderr.includes('administrator'))) {
        this.logAuditEvent('block_ip', ip, false, 'INSUFFICIENT_PRIVILEGES', { error: psResult.stderr });
        return {
          success: false,
          error: 'Administrator privileges are required to modify Windows Defender Firewall rules.',
          errorCode: 'INSUFFICIENT_PRIVILEGES',
        };
      }

      this.blockedIps.set(ip, newBlockedIp);
      this.saveStateToDisk();
      this.logAuditEvent('block_ip', ip, true);

      return { success: true, blockedIp: newBlockedIp };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to apply Windows Defender Firewall rule';
      this.lastError = errMsg;
      this.logAuditEvent('block_ip', ip, false, 'FIREWALL_ERROR', { error: errMsg });

      return {
        success: false,
        error: errMsg,
        errorCode: 'FIREWALL_ERROR',
      };
    }
  }

  public async unblockIp(rawIp: string): Promise<UnblockIpResult> {
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

    const ruleName = this.getRuleNameForIp(ip);

    try {
      const psResult = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Remove-NetFirewallRule -DisplayName "${ruleName}" -ErrorAction SilentlyContinue`,
      ]);

      const stderr = (psResult.stderr || '').toLowerCase();
      if (psResult.exitCode !== 0 && (stderr.includes('access is denied') || stderr.includes('permission denied') || stderr.includes('administrator'))) {
        this.logAuditEvent('unblock_ip', ip, false, 'INSUFFICIENT_PRIVILEGES', { error: psResult.stderr });
        return {
          success: false,
          error: 'Administrator privileges are required to remove Windows Defender Firewall rules.',
          errorCode: 'INSUFFICIENT_PRIVILEGES',
        };
      }

      this.blockedIps.delete(ip);
      this.saveStateToDisk();
      this.logAuditEvent('unblock_ip', ip, true);

      return { success: true, unblockedIp: ip };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to remove Windows Defender Firewall rule';
      this.lastError = errMsg;
      this.logAuditEvent('unblock_ip', ip, false, 'FIREWALL_ERROR', { error: errMsg });

      return {
        success: false,
        error: errMsg,
        errorCode: 'FIREWALL_ERROR',
      };
    }
  }

  public getBlockedIps(): BlockedIp[] {
    return Array.from(this.blockedIps.values());
  }

  public isIpBlocked(ip: string): boolean {
    const val = validateIpAddress(ip);
    if (!val.isValid || !val.normalizedIp) return false;
    return this.blockedIps.has(val.normalizedIp);
  }

  public getFirewallStatus(): FirewallStatus {
    return {
      isAvailable: true,
      isAnchorLoaded: true,
      anchorName: WINDOWS_FIREWALL_RULE_PREFIX,
      totalBlocked: this.blockedIps.size,
      lastError: this.lastError,
      dryRunMode: false,
    };
  }

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
    } catch {
      // Ignore corrupted file on startup
    }
  }

  private saveStateToDisk(): void {
    try {
      const data = Array.from(this.blockedIps.values());
      const tempPath = `${this.stateFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.stateFilePath);
    } catch {
      // Non-fatal logging
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
      id: `win-fw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
