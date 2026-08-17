import type { TrafficSummary, ProcessTraffic } from '@network-monitor/shared';
import type { IPlatformTrafficProvider } from '../interfaces/traffic-provider.interface.js';

import { NettopService, nettopService } from '../../services/nettop.service.js';

export class MacTrafficProvider implements IPlatformTrafficProvider {
  constructor(private readonly nettop: NettopService = nettopService) {}

  public async sampleTraffic(): Promise<TrafficSummary> {
    return this.nettop.sampleTraffic();
  }

  public getAllProcessTraffic(): ProcessTraffic[] {
    return this.nettop.getAllProcessTraffic();
  }

  public getTrafficForPid(pid: number): ProcessTraffic | undefined {
    return this.nettop.getTrafficForPid(pid) ?? undefined;
  }
}


export const macTrafficProvider = new MacTrafficProvider();
