import os from 'node:os';
import { NetworkConnection, ProcessSignal } from '@network-monitor/shared';
import { CommandRunnerService, commandRunner } from './command-runner.service.js';

import { LsofService, lsofService } from './lsof.service.js';
import { NettopService, nettopService } from './nettop.service.js';
import { NetworkMonitorService, networkMonitorService } from './network-monitor.service.js';
import { PfFirewallService, pfFirewallService } from './pf-firewall.service.js';
import { TrafficSummary, ProcessTraffic, BlockedIp, FirewallStatus } from '@network-monitor/shared';

export interface IMacOSService {
  isMacOS(): boolean;
  getSystemMetadata(): SystemMetadata;
  getNetworkConnections(): Promise<NetworkConnection[]>;
  sampleTraffic(): Promise<TrafficSummary>;
  getAllProcessTraffic(): ProcessTraffic[];
  terminateProcess(pid: number, signal: ProcessSignal, dryRun?: boolean): Promise<{ success: boolean; message: string }>;
  blockIp(ip: string, comment?: string): Promise<{ success: boolean; blockedIp?: BlockedIp; error?: string; errorCode?: string }>;
  unblockIp(ip: string): Promise<{ success: boolean; unblockedIp?: string; error?: string; errorCode?: string }>;
  getFirewallStatus(): FirewallStatus;
}

export interface SystemMetadata {
  platform: string;
  release: string;
  arch: string;
  uptime: number;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}

/**
 * Service abstraction for macOS system operations.
 * Isolates all system CLI operations (lsof, nettop, pfctl).
 */
export class MacOSService implements IMacOSService {
  private readonly lsof: LsofService;
  private readonly nettop: NettopService;
  private readonly monitor: NetworkMonitorService;
  private readonly firewall: PfFirewallService;

  constructor(
    private readonly runner: CommandRunnerService = commandRunner,
    lsof: LsofService = lsofService,
    nettop: NettopService = nettopService,
    monitor: NetworkMonitorService = networkMonitorService,
    firewall: PfFirewallService = pfFirewallService
  ) {
    this.lsof = lsof;
    this.nettop = nettop;
    this.monitor = monitor;
    this.firewall = firewall;
  }

  /**
   * Accessor for underlying command runner service.
   */
  public getCommandRunner(): CommandRunnerService {
    return this.runner;
  }

  public getLsofService(): LsofService {
    return this.lsof;
  }

  public getNettopService(): NettopService {
    return this.nettop;
  }

  public getFirewallService(): PfFirewallService {
    return this.firewall;
  }

  /**
   * Checks if the host OS is macOS (darwin).
   */
  public isMacOS(): boolean {
    return os.platform() === 'darwin';
  }

  /**
   * Safe, unprivileged system metadata.
   */
  public getSystemMetadata(): SystemMetadata {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime: os.uptime(),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }

  /**
   * Discovers active network connections via lsof, merged with process-level traffic.
   */
  public async getNetworkConnections(): Promise<NetworkConnection[]> {
    if (process.platform === 'win32') {
      const { platformService } = await import('../platform/index.js');
      return platformService.getNetworkProvider().getConnections();
    }
    return this.monitor.getEnrichedConnections();
  }

  /**
   * Samples live nettop traffic and returns summary.
   */
  public async sampleTraffic(): Promise<TrafficSummary> {
    if (process.platform === 'win32') {
      const { platformService } = await import('../platform/index.js');
      return platformService.getTrafficProvider().sampleTraffic();
    }
    return this.monitor.sampleTraffic();
  }


  /**
   * Retrieves current process traffic list.
   */
  public getAllProcessTraffic(): ProcessTraffic[] {
    return this.monitor.getAllProcessTraffic();
  }

  /**
   * Safely terminates a process by PID using POSIX kill signal.
   * Protects system processes (PID <= 1) and handles permissions.
   */
  public async terminateProcess(
    pid: number,
    signal: ProcessSignal = 'SIGTERM',
    dryRun = false
  ): Promise<{ success: boolean; message: string }> {
    if (pid <= 1) {
      return {
        success: false,
        message: `Safety violation: Refusing to terminate system process PID ${pid}.`,
      };
    }

    if (dryRun) {
      return {
        success: true,
        message: `[Dry Run] Simulated sending ${signal} to PID ${pid}.`,
      };
    }

    try {
      // Direct POSIX signal execution
      process.kill(pid, signal);
      return {
        success: true,
        message: `Successfully sent ${signal} to PID ${pid}.`,
      };
    } catch (error: any) {
      if (error.code === 'ESRCH') {
        return {
          success: true,
          message: `Process PID ${pid} was already terminated.`,
        };
      } else if (error.code === 'EPERM') {
        return {
          success: false,
          message: `Permission denied: Insufficient privileges to terminate PID ${pid}.`,
        };
      } else {
        return {
          success: false,
          message: error.message || `Failed to send ${signal} to PID ${pid}.`,
        };
      }
    }
  }

  /**
   * Blocks an IP address in the application-owned PF anchor.
   */
  public async blockIp(
    ip: string,
    comment?: string
  ): Promise<{ success: boolean; blockedIp?: BlockedIp; error?: string; errorCode?: string }> {
    return this.firewall.blockIp(ip, comment);
  }

  /**
   * Unblocks an IP address from the application-owned PF anchor.
   */
  public async unblockIp(
    ip: string
  ): Promise<{ success: boolean; unblockedIp?: string; error?: string; errorCode?: string }> {
    return this.firewall.unblockIp(ip);
  }

  /**
   * Retrieves current firewall status.
   */
  public getFirewallStatus(): FirewallStatus {
    return this.firewall.getFirewallStatus();
  }
}

export const macosService = new MacOSService();
