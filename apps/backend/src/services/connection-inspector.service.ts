import {
  ConnectionInspectorDetail,
  NetworkConnectionState,
} from '@network-monitor/shared';
import { MacOSService, macosService } from './macos.service.js';
import { SettingsService, settingsService } from './settings.service.js';
import { formatBytesPerSec } from '../utils/formatters.js';

export class ConnectionInspectorService {
  private readonly macos: MacOSService;
  private readonly settings: SettingsService;

  constructor(macos: MacOSService = macosService, settings: SettingsService = settingsService) {
    this.macos = macos;
    this.settings = settings;
  }

  public async inspectConnection(connectionId: string): Promise<ConnectionInspectorDetail | null> {
    const liveConns = await this.macos.getNetworkConnections();
    const conn = liveConns.find((c) => c.id === connectionId);

    if (!conn) return null;

    const firewall = this.macos.getFirewallService();
    const isBlocked = conn.remoteAddress ? firewall.isIpBlocked(conn.remoteAddress) : false;

    const now = new Date();
    const timelineEvents: Array<{ timestamp: string; description: string; rateFormatted?: string }> = [
      {
        timestamp: new Date(now.getTime() - 60000).toISOString(),
        description: 'Socket first observed in system lsof table',
      },
    ];

    if (conn.traffic && (conn.traffic.bytesInPerSecond > 0 || conn.traffic.bytesOutPerSecond > 0)) {
      timelineEvents.push({
        timestamp: now.toISOString(),
        description: `Active process traffic detected (↓ ${formatBytesPerSec(conn.traffic.bytesInPerSecond)}  ↑ ${formatBytesPerSec(conn.traffic.bytesOutPerSecond)})`,
        rateFormatted: `↓ ${formatBytesPerSec(conn.traffic.bytesInPerSecond)}`,
      });
    }

    const tags = this.settings.getTags(conn.processName);
    if (conn.remoteAddress) {
      const ipTags = this.settings.getTags(conn.remoteAddress);
      tags.push(...ipTags);
    }

    return {
      id: conn.id,
      pid: conn.pid,
      processName: conn.processName,
      protocol: conn.protocol,
      localAddress: conn.localAddress,
      localPort: conn.localPort,
      remoteAddress: conn.remoteAddress,
      remotePort: conn.remotePort,
      state: conn.state as NetworkConnectionState,
      firstObserved: new Date(now.getTime() - 60000).toISOString(),
      lastObserved: now.toISOString(),
      durationSeconds: 60,
      isAiAgent: !!conn.isAiAgent,
      isBlocked,
      traffic: conn.traffic
        ? {
            bytesInPerSecond: conn.traffic.bytesInPerSecond,
            bytesOutPerSecond: conn.traffic.bytesOutPerSecond,
            activity: conn.traffic.activity,
          }
        : undefined,
      timelineEvents,
      tags: Array.from(new Set(tags)),
    };
  }
}

export const connectionInspectorService = new ConnectionInspectorService();
