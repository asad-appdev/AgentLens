import type { NetworkConnection } from '@network-monitor/shared';
import type { IPlatformNetworkProvider, NetworkDiscoveryOptions } from '../interfaces/network-provider.interface.js';
import { CommandRunnerService, commandRunner } from '../../services/command-runner.service.js';
import { parseWindowsTcpJson, parseWindowsUdpJson, parseWindowsNetstatOutput } from './parsers/windows-net-tcp.parser.js';
import { WindowsProcessProvider } from './windows-process.provider.js';
import type { IPlatformTrafficProvider } from '../interfaces/traffic-provider.interface.js';


export class WindowsNetworkProvider implements IPlatformNetworkProvider {
  constructor(
    private readonly runner: CommandRunnerService = commandRunner,
    private readonly processProvider?: WindowsProcessProvider,
    private readonly trafficProvider?: IPlatformTrafficProvider
  ) {}

  public async getConnections(options: NetworkDiscoveryOptions = {}): Promise<NetworkConnection[]> {
    const discoveredAt = options.discoveredAt || new Date().toISOString();

    // 1. Build PID -> Process Name map
    const processNameMap = new Map<number, string>();
    if (this.processProvider) {
      const procList = await this.processProvider.getRawProcessList();
      for (const p of procList) {
        processNameMap.set(p.pid, p.comm);
      }
    }

    let tcpConnections: NetworkConnection[] = [];
    let udpConnections: NetworkConnection[] = [];

    // 2. Discover TCP connections via PowerShell
    try {
      const tcpResult = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-NetTCPConnection | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | ConvertTo-Json -Compress',
      ]);

      if (tcpResult.exitCode === 0 && tcpResult.stdout.trim()) {
        tcpConnections = parseWindowsTcpJson(tcpResult.stdout, processNameMap, discoveredAt);
      }
    } catch {
      // Will fallback to netstat if PowerShell encounters an error
    }

    // 3. Discover UDP endpoints via PowerShell
    try {
      const udpResult = await this.runner.execute('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-NetUDPEndpoint | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress',
      ]);

      if (udpResult.exitCode === 0 && udpResult.stdout.trim()) {
        udpConnections = parseWindowsUdpJson(udpResult.stdout, processNameMap, discoveredAt);
      }
    } catch {
      // Fallback
    }

    // 4. If PowerShell returned nothing, execute netstat fallback
    if (tcpConnections.length === 0 && udpConnections.length === 0) {
      try {
        const netstatResult = await this.runner.execute('netstat', ['-ano']);
        if (netstatResult.exitCode === 0 && netstatResult.stdout.trim()) {
          const allNetstat = parseWindowsNetstatOutput(netstatResult.stdout, processNameMap, discoveredAt);
          return this.enrichConnections(allNetstat);
        }
      } catch {
        return [];
      }
    }

    const combined = [...tcpConnections, ...udpConnections];
    return this.enrichConnections(combined);
  }

  private enrichConnections(connections: NetworkConnection[]): NetworkConnection[] {
    return connections.map((conn) => {
      let connectionTraffic = conn.traffic;
      let isAiAgent = conn.isAiAgent;
      let aiAgentName = conn.aiAgentName;

      if (this.trafficProvider) {
        const procTraffic = this.trafficProvider.getTrafficForPid(conn.pid);
        if (procTraffic) {
          connectionTraffic = {
            bytesInPerSecond: procTraffic.bytesInPerSecond,
            bytesOutPerSecond: procTraffic.bytesOutPerSecond,
            totalBytesPerSecond: procTraffic.totalBytesPerSecond,
            activity: procTraffic.activity,
            scope: 'PROCESS',
          };
          if (procTraffic.isAiAgent) {
            isAiAgent = true;
            aiAgentName = procTraffic.aiAgentName;
          }
        }
      }

      let isSelf = false;
      let selfRole: string | undefined = undefined;

      if (conn.localPort === 43121 || conn.pid === process.pid) {
        isSelf = true;
        selfRole = 'AgentLens (Backend)';
      } else if (conn.localPort === 5174) {
        isSelf = true;
        selfRole = 'AgentLens (Frontend)';
      }

      return {
        ...conn,
        platform: 'win32',
        traffic: connectionTraffic,
        isAiAgent,
        aiAgentName,
        isSelf,
        selfRole,
      };
    });
  }
}
