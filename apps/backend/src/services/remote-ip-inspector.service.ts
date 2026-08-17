import { RemoteIpInspectorDetail } from '@network-monitor/shared';
import { MacOSService, macosService } from './macos.service.js';
import { HistoryService, historyService } from './history.service.js';

export class RemoteIpInspectorService {
  private readonly macos: MacOSService;
  private readonly history: HistoryService;

  constructor(macos: MacOSService = macosService, history: HistoryService = historyService) {
    this.macos = macos;
    this.history = history;
  }

  public async inspectRemoteIp(ip: string): Promise<RemoteIpInspectorDetail | null> {
    const liveConns = await this.macos.getNetworkConnections();
    const liveMatching = liveConns.filter((c) => c.remoteAddress?.toLowerCase() === ip.toLowerCase());

    const firewall = this.macos.getFirewallService();
    const isBlocked = firewall.isIpBlocked(ip);

    // Group associated processes
    const procMap = new Map<number, {
      pid: number;
      processName: string;
      isAiAgent: boolean;
      ports: Set<number>;
      trafficIn: number;
      trafficOut: number;
    }>();

    for (const c of liveMatching) {
      if (!procMap.has(c.pid)) {
        procMap.set(c.pid, {
          pid: c.pid,
          processName: c.processName,
          isAiAgent: !!c.isAiAgent,
          ports: new Set(),
          trafficIn: c.traffic?.bytesInPerSecond || 0,
          trafficOut: c.traffic?.bytesOutPerSecond || 0,
        });
      }
      if (c.remotePort !== null) {
        procMap.get(c.pid)!.ports.add(c.remotePort);
      }
    }

    const histConns = this.history.queryConnections({ remoteAddress: ip, limit: 100 });
    const firstObserved = histConns.records[histConns.records.length - 1]?.timestamp || new Date().toISOString();
    const lastObserved = histConns.records[0]?.timestamp || new Date().toISOString();

    return {
      remoteAddress: ip,
      firstObserved,
      lastObserved,
      totalConnections: Math.max(histConns.total, liveMatching.length),
      activeConnectionsCount: liveMatching.length,
      isBlocked,
      associatedProcesses: Array.from(procMap.values()).map((p) => ({
        pid: p.pid,
        processName: p.processName,
        isAiAgent: p.isAiAgent,
        ports: Array.from(p.ports),
        trafficIn: p.trafficIn,
        trafficOut: p.trafficOut,
      })),
    };
  }
}

export const remoteIpInspectorService = new RemoteIpInspectorService();
