import os from 'node:os';
import type { PlatformInfo } from '@network-monitor/shared';
import type { IPlatformSystemProvider, SystemMetadata } from '../interfaces/system-provider.interface.js';



export class MacSystemProvider implements IPlatformSystemProvider {
  public getPlatformInfo(): PlatformInfo {
    return {
      platform: 'darwin',
      os: 'macOS',
      architecture: os.arch(),
      release: os.release(),
      supported: true,
    };
  }

  public getSystemMetadata(): SystemMetadata {
    return {
      platform: 'darwin',
      release: os.release(),
      arch: os.arch(),
      uptime: Math.floor(os.uptime()),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }
}

export const macSystemProvider = new MacSystemProvider();
