import {
  NetworkConnection,
  ConnectionTraffic,
  ProcessTraffic,
  TrafficSummary,
} from '@network-monitor/shared';
import { LsofService, lsofService } from './lsof.service.js';
import { NettopService, nettopService } from './nettop.service.js';

export class NetworkMonitorService {
  private readonly lsof: LsofService;
  private readonly nettop: NettopService;

  constructor(lsof: LsofService = lsofService, nettop: NettopService = nettopService) {
    this.lsof = lsof;
    this.nettop = nettop;
  }

  /**
   * Retrieves fresh network connections and attaches process-level traffic metadata.
   */
  public async getEnrichedConnections(): Promise<NetworkConnection[]> {
    const rawConnections = await this.lsof.discoverConnections();
    return this.mergeConnectionsWithTraffic(rawConnections);
  }

  /**
   * Merges raw NetworkConnection objects with the latest process-level traffic registry.
   */
  public mergeConnectionsWithTraffic(connections: NetworkConnection[]): NetworkConnection[] {
    return connections.map((conn) => {
      const traffic = this.nettop.getTrafficForPid(conn.pid);

      let connectionTraffic: ConnectionTraffic | undefined = undefined;
      let isAiAgent = conn.isAiAgent;
      let aiAgentName = conn.aiAgentName;

      if (traffic) {
        connectionTraffic = {
          bytesInPerSecond: traffic.bytesInPerSecond,
          bytesOutPerSecond: traffic.bytesOutPerSecond,
          totalBytesPerSecond: traffic.totalBytesPerSecond,
          activity: traffic.activity,
          scope: 'PROCESS', // Explicitly label measurement scope as PROCESS
        };

        if (traffic.isAiAgent) {
          isAiAgent = true;
          aiAgentName = traffic.aiAgentName;
        }
      }

      // Check if this connection belongs to the Network Monitor itself
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
        traffic: connectionTraffic,
        isAiAgent,
        aiAgentName,
        isSelf,
        selfRole,
      };
    });
  }

  /**
   * Samples live nettop traffic and returns summary.
   */
  public async sampleTraffic(): Promise<TrafficSummary> {
    return this.nettop.sampleTraffic();
  }

  /**
   * Retrieves current process traffic list.
   */
  public getAllProcessTraffic(): ProcessTraffic[] {
    return this.nettop.getAllProcessTraffic();
  }
}

export const networkMonitorService = new NetworkMonitorService();
