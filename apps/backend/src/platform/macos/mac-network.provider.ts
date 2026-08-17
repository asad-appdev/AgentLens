import type { NetworkConnection } from '@network-monitor/shared';
import type { IPlatformNetworkProvider, NetworkDiscoveryOptions } from '../interfaces/network-provider.interface.js';

import { LsofService, lsofService } from '../../services/lsof.service.js';
import { NettopService, nettopService } from '../../services/nettop.service.js';

export class MacNetworkProvider implements IPlatformNetworkProvider {
  constructor(
    private readonly lsof: LsofService = lsofService,
    private readonly nettop: NettopService = nettopService
  ) {}

  public async getConnections(options: NetworkDiscoveryOptions = {}): Promise<NetworkConnection[]> {
    const raw = await this.lsof.discoverConnections(options);
    return raw.map((conn) => {
      const traffic = this.nettop.getTrafficForPid(conn.pid);

      let isAiAgent = conn.isAiAgent;
      let aiAgentName = conn.aiAgentName;

      let connectionTraffic = conn.traffic;
      if (traffic) {
        connectionTraffic = {
          bytesInPerSecond: traffic.bytesInPerSecond,
          bytesOutPerSecond: traffic.bytesOutPerSecond,
          totalBytesPerSecond: traffic.totalBytesPerSecond,
          activity: traffic.activity,
          scope: 'PROCESS',
        };

        if (traffic.isAiAgent) {
          isAiAgent = true;
          aiAgentName = traffic.aiAgentName;
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
        platform: 'darwin',
        traffic: connectionTraffic,
        isAiAgent,
        aiAgentName,
        isSelf,
        selfRole,
      };
    });
  }
}

export const macNetworkProvider = new MacNetworkProvider();
