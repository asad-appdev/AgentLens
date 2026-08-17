import type {
  LocalServerInfo,
  KillPortRequest,
  KillPortResult,
  KillProcessesRequest,
  KillProcessesResponse,
} from '@network-monitor/shared';
import type { IPlatformServerDetector } from '../interfaces/server-detector.interface.js';

import { LocalServersService, localServersService } from '../../services/local-servers.service.js';

export class MacServerDetector implements IPlatformServerDetector {
  constructor(private readonly localServers: LocalServersService = localServersService) {}

  public async discoverLocalServers(): Promise<LocalServerInfo[]> {
    return this.localServers.discoverLocalServers();
  }

  public async killPort(req: KillPortRequest): Promise<KillPortResult> {
    return this.localServers.killPort(req);
  }

  public async killProcesses(req: KillProcessesRequest): Promise<KillProcessesResponse> {
    return this.localServers.killProcesses(req);
  }
}

export const macServerDetector = new MacServerDetector();
