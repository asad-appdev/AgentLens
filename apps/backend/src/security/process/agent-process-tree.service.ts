import { SecuritySeverity } from '@network-monitor/shared';
import { platformService } from '../../platform/platform.service.js';

export interface ProcessNode {
  pid: number;
  name: string;
  commandLine?: string;
  parentPid?: number;
  cpu?: number;
  memoryMb?: number;
  children: ProcessNode[];
  isUnusual?: boolean;
  unusualReason?: string;
  riskLevel?: SecuritySeverity;
}

export interface UnusualChildProcessEvent {
  id: string;
  agentId: string;
  agentName: string;
  rootPid: number;
  parentPid: number;
  parentProcessName: string;
  childPid: number;
  childProcessName: string;
  commandLine?: string;
  reason: string;
  riskLevel: SecuritySeverity;
  confidence: number;
  timestamp: string;
}

const COMMON_SAFE_DEV_CHILDREN = new Set([
  'git',
  'npm',
  'node',
  'tsc',
  'eslint',
  'prettier',
  'cargo',
  'rustc',
  'go',
  'python',
  'python3',
  'pip',
  'yarn',
  'pnpm',
  'vite',
  'webpack',
  'cat',
  'grep',
  'find',
  'ls',
  'dir',
  'mkdir',
  'echo',
]);

const SUSPICIOUS_SHELL_TOOLS = new Set([
  'nc',
  'netcat',
  'ncat',
  'certutil',
  'certutil.exe',
  'bitsadmin',
  'bitsadmin.exe',
  'curl',
  'curl.exe',
  'wget',
  'powershell',
  'powershell.exe',
  'pwsh',
  'pwsh.exe',
  'cmd.exe',
  'osascript',
  'dscl',
  'reg.exe',
  'regedit.exe',
  'vssadmin',
]);

export class AgentProcessTreeService {
  private knownSessionChildren = new Map<string, Set<string>>(); // agentId -> Set of lowercase process names

  /**
   * Builds full hierarchical process tree for a given root PID using the platform process provider.
   */
  public async getProcessTreeForAgent(
    agentId: string,
    rootPid: number
  ): Promise<{ root: ProcessNode | null; allPids: number[]; unusualEvents: UnusualChildProcessEvent[] }> {
    const processProvider = platformService.getProcessProvider();
    const rawList = await processProvider.getRawProcessList();

    const procMap = new Map<number, { pid: number; ppid: number; name: string; cmd: string }>();
    const childrenMap = new Map<number, number[]>();

    for (const p of rawList) {
      procMap.set(p.pid, { pid: p.pid, ppid: p.ppid, name: p.comm, cmd: p.args });
      if (!childrenMap.has(p.ppid)) {
        childrenMap.set(p.ppid, []);
      }
      childrenMap.get(p.ppid)!.push(p.pid);
    }

    const rootInfo = procMap.get(rootPid);
    if (!rootInfo) {
      return { root: null, allPids: [rootPid], unusualEvents: [] };
    }

    const allPids: number[] = [];
    const unusualEvents: UnusualChildProcessEvent[] = [];

    let knownSet = this.knownSessionChildren.get(agentId);
    if (!knownSet) {
      knownSet = new Set<string>();
      this.knownSessionChildren.set(agentId, knownSet);
    }

    const visitedPids = new Set<number>();

    const buildSubtree = (currentPid: number, parentName?: string, parentPid?: number): ProcessNode => {
      visitedPids.add(currentPid);
      allPids.push(currentPid);
      const info = procMap.get(currentPid) || { pid: currentPid, ppid: parentPid || 0, name: 'unknown', cmd: '' };
      const procNameLower = info.name.toLowerCase();
      const cmdLower = info.cmd.toLowerCase();

      let isUnusual = false;
      let unusualReason: string | undefined;
      let riskLevel: SecuritySeverity = 'INFO';

      if (currentPid !== rootPid) {
        const isToolSuspicious = SUSPICIOUS_SHELL_TOOLS.has(procNameLower) ||
          SUSPICIOUS_SHELL_TOOLS.has(procNameLower.replace(/\.exe$/, ''));

        const hasEncodedOrDownloadCommand = cmdLower.includes('-enc') ||
          cmdLower.includes('downloadstring') ||
          cmdLower.includes('iex') ||
          cmdLower.includes('curl ') ||
          cmdLower.includes('wget ');

        if (isToolSuspicious || hasEncodedOrDownloadCommand) {
          isUnusual = true;
          riskLevel = hasEncodedOrDownloadCommand ? 'HIGH' : 'MEDIUM';
          unusualReason = `Spawned command utility '${info.name}' with potentially high-impact shell/network parameters`;
        } else if (!COMMON_SAFE_DEV_CHILDREN.has(procNameLower) && !knownSet!.has(procNameLower)) {
          isUnusual = true;
          riskLevel = 'LOW';
          unusualReason = `Process '${info.name}' has not previously been observed in this agent session`;
        }

        if (isUnusual) {
          unusualEvents.push({
            id: `proc-unusual-${Date.now()}-${currentPid}`,
            agentId,
            agentName: agentId,
            rootPid,
            parentPid: parentPid || rootPid,
            parentProcessName: parentName || 'agent-root',
            childPid: currentPid,
            childProcessName: info.name,
            commandLine: info.cmd,
            reason: unusualReason || 'Unusual child process pattern observed',
            riskLevel,
            confidence: 0.85,
            timestamp: new Date().toISOString(),
          });
        }

        knownSet!.add(procNameLower);
      }

      const childPids = (childrenMap.get(currentPid) || []).filter((cPid) => !visitedPids.has(cPid));
      const childrenNodes = childPids.map((cPid) => buildSubtree(cPid, info.name, currentPid));

      return {
        pid: currentPid,
        name: info.name,
        commandLine: info.cmd,
        parentPid: info.ppid,
        children: childrenNodes,
        isUnusual,
        unusualReason,
        riskLevel,
      };
    };

    const rootNode = buildSubtree(rootPid);
    return { root: rootNode, allPids, unusualEvents };
  }

  /**
   * Resets session memory for testing or history cleanup.
   */
  public resetSession(agentId?: string): void {
    if (agentId) {
      this.knownSessionChildren.delete(agentId);
    } else {
      this.knownSessionChildren.clear();
    }
  }
}

export const agentProcessTreeService = new AgentProcessTreeService();
