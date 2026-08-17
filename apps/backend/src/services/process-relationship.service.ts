import { ProcessTreeNode } from '@network-monitor/shared';
import { CommandRunnerService, commandRunner } from './command-runner.service.js';
import { platformService } from '../platform/index.js';
import type { RawProcessInfo } from '../platform/interfaces/process-provider.interface.js';
import { MacProcessProvider } from '../platform/macos/mac-process.provider.js';
import { WindowsProcessProvider } from '../platform/windows/windows-process.provider.js';

export type { RawProcessInfo };


export class ProcessRelationshipService {
  constructor(private readonly runner: CommandRunnerService = commandRunner) {}

  public getCommandRunner(): CommandRunnerService {
    return this.runner;
  }

  /**
   * Retrieves current system process parent/child hierarchy.
   */
  public async getRawProcessList(): Promise<RawProcessInfo[]> {
    if (platformService.isWindows()) {
      return new WindowsProcessProvider(this.runner).getRawProcessList();
    }
    return new MacProcessProvider(this.runner).getRawProcessList();
  }

  /**
   * Builds parent-child relationship tree for active network processes.
   */
  public async buildProcessTree(activePids: number[]): Promise<ProcessTreeNode[]> {
    if (platformService.isWindows()) {
      return new WindowsProcessProvider(this.runner).buildProcessTree(activePids);
    }
    return new MacProcessProvider(this.runner).buildProcessTree(activePids);
  }

  /**
   * Gets parent and direct children for a specific PID.
   */
  public async getProcessFamily(pid: number): Promise<{
    parent: { pid: number; processName: string } | null;
    children: Array<{ pid: number; processName: string }>;
  }> {
    if (platformService.isWindows()) {
      return new WindowsProcessProvider(this.runner).getProcessFamily(pid);
    }
    return new MacProcessProvider(this.runner).getProcessFamily(pid);
  }
}

export const processRelationshipService = new ProcessRelationshipService();
