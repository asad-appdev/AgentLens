import type { BlockedIp, FirewallStatus, FirewallAuditEvent } from '@network-monitor/shared';
import type { IPlatformFirewallProvider, BlockIpResult, UnblockIpResult } from '../interfaces/firewall-provider.interface.js';

import { PfFirewallService, pfFirewallService } from '../../services/pf-firewall.service.js';

export class MacFirewallProvider implements IPlatformFirewallProvider {
  constructor(private readonly firewall: PfFirewallService = pfFirewallService) {}

  public async blockIp(ip: string, comment?: string): Promise<BlockIpResult> {
    return this.firewall.blockIp(ip, comment);
  }

  public async unblockIp(ip: string): Promise<UnblockIpResult> {
    return this.firewall.unblockIp(ip);
  }

  public getBlockedIps(): BlockedIp[] {
    return this.firewall.getBlockedIps();
  }

  public isIpBlocked(ip: string): boolean {
    return this.firewall.isIpBlocked(ip);
  }

  public getFirewallStatus(): FirewallStatus {
    return this.firewall.getFirewallStatus();
  }

  public getAuditEvents(): FirewallAuditEvent[] {
    return this.firewall.getAuditEvents();
  }
}

export const macFirewallProvider = new MacFirewallProvider();
