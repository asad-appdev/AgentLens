import { BlockedIp, FirewallStatus, FirewallAuditEvent } from '@network-monitor/shared';

export interface BlockIpResult {
  success: boolean;
  blockedIp?: BlockedIp;
  error?: string;
  errorCode?: string;
}

export interface UnblockIpResult {
  success: boolean;
  unblockedIp?: string;
  error?: string;
  errorCode?: string;
}

export interface IPlatformFirewallProvider {
  /**
   * Blocks a remote IP address using platform-native firewall controls (PF on macOS, Windows Defender Firewall on Windows).
   */
  blockIp(ip: string, comment?: string): Promise<BlockIpResult>;

  /**
   * Unblocks an IP address from the platform-native firewall.
   */
  unblockIp(ip: string): Promise<UnblockIpResult>;

  /**
   * Returns list of currently blocked IP addresses managed by this application.
   */
  getBlockedIps(): BlockedIp[];

  /**
   * Checks if an IP is currently blocked.
   */
  isIpBlocked(ip: string): boolean;

  /**
   * Returns operational firewall status.
   */
  getFirewallStatus(): FirewallStatus;

  /**
   * Returns recent audit log events for firewall actions.
   */
  getAuditEvents(): FirewallAuditEvent[];
}
