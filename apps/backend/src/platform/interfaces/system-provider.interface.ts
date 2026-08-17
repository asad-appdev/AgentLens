import { PlatformInfo } from '@network-monitor/shared';

export interface SystemMetadata {
  platform: string;
  release: string;
  arch: string;
  uptime: number;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}

export interface IPlatformSystemProvider {
  /**
   * Returns normalized platform information and OS support status.
   */
  getPlatformInfo(): PlatformInfo;

  /**
   * Returns host machine system metadata (CPU, memory, uptime, etc.).
   */
  getSystemMetadata(): SystemMetadata;
}
