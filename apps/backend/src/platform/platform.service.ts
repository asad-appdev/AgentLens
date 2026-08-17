import process from 'node:process';
import type {
  IPlatformNetworkProvider,
  IPlatformTrafficProvider,
  IPlatformProcessProvider,
  IPlatformFirewallProvider,
  IPlatformSystemProvider,
  IPlatformServerDetector,
} from './interfaces/index.js';
import { PlatformBundle, PlatformFactory } from './platform.factory.js';
import { PlatformInfo } from '@network-monitor/shared';

export class PlatformService {
  private bundle: PlatformBundle;
  private currentPlatform: string;

  constructor(targetPlatform: string = process.platform) {
    this.currentPlatform = targetPlatform;
    this.bundle = PlatformFactory.createBundle(targetPlatform);
  }

  /**
   * Overrides the active platform bundle (primarily for testing and simulations).
   */
  public setPlatform(targetPlatform: string): void {
    this.currentPlatform = targetPlatform;
    this.bundle = PlatformFactory.createBundle(targetPlatform);
  }

  public getPlatform(): string {
    return this.currentPlatform;
  }

  public isMacOS(): boolean {
    return this.currentPlatform === 'darwin';
  }

  public isWindows(): boolean {
    return this.currentPlatform === 'win32';
  }

  public getPlatformInfo(): PlatformInfo {
    return this.bundle.system.getPlatformInfo();
  }

  public getNetworkProvider(): IPlatformNetworkProvider {
    return this.bundle.network;
  }

  public getTrafficProvider(): IPlatformTrafficProvider {
    return this.bundle.traffic;
  }

  public getProcessProvider(): IPlatformProcessProvider {
    return this.bundle.process;
  }

  public getFirewallProvider(): IPlatformFirewallProvider {
    return this.bundle.firewall;
  }

  public getSystemProvider(): IPlatformSystemProvider {
    return this.bundle.system;
  }

  public getServerDetector(): IPlatformServerDetector {
    return this.bundle.serverDetector;
  }
}

export const platformService = new PlatformService();
