import os from 'node:os';
import type { PlatformInfo } from '@network-monitor/shared';
import type { IPlatformSystemProvider, SystemMetadata } from '../interfaces/system-provider.interface.js';


export class WindowsSystemProvider implements IPlatformSystemProvider {
  public getPlatformInfo(): PlatformInfo {
    return {
      platform: 'win32',
      os: 'Windows',
      architecture: os.arch(),
      release: os.release(),
      supported: true,
    };
  }

  public getSystemMetadata(): SystemMetadata {
    return {
      platform: 'win32',
      release: os.release(),
      arch: os.arch(),
      uptime: Math.floor(os.uptime()),
      cpuCount: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }
}

export const windowsSystemProvider = new WindowsSystemProvider();
