import process from 'node:process';
import type {
  IPlatformNetworkProvider,
  IPlatformTrafficProvider,
  IPlatformProcessProvider,
  IPlatformFirewallProvider,
  IPlatformSystemProvider,
  IPlatformServerDetector,
} from './interfaces/index.js';

import {
  MacNetworkProvider,
  MacTrafficProvider,
  MacProcessProvider,
  MacFirewallProvider,
  MacSystemProvider,
  MacServerDetector,
} from './macos/index.js';
import {
  WindowsNetworkProvider,
  WindowsTrafficProvider,
  WindowsProcessProvider,
  WindowsFirewallProvider,
  WindowsSystemProvider,
  WindowsServerDetector,
} from './windows/index.js';
import { CommandRunnerService, commandRunner } from '../services/command-runner.service.js';

export interface PlatformBundle {
  network: IPlatformNetworkProvider;
  traffic: IPlatformTrafficProvider;
  process: IPlatformProcessProvider;
  firewall: IPlatformFirewallProvider;
  system: IPlatformSystemProvider;
  serverDetector: IPlatformServerDetector;
}

export class PlatformFactory {
  /**
   * Instantiates platform-specific provider bundle for the specified or current platform.
   */
  public static createBundle(
    targetPlatform: string = process.platform,
    runner: CommandRunnerService = commandRunner
  ): PlatformBundle {
    if (targetPlatform === 'win32') {
      const processProvider = new WindowsProcessProvider(runner);
      const trafficProvider = new WindowsTrafficProvider(runner);
      const networkProvider = new WindowsNetworkProvider(runner, processProvider, trafficProvider);
      const firewallProvider = new WindowsFirewallProvider({ runner });
      const systemProvider = new WindowsSystemProvider();
      const serverDetector = new WindowsServerDetector(networkProvider, processProvider);

      return {
        network: networkProvider,
        traffic: trafficProvider,
        process: processProvider,
        firewall: firewallProvider,
        system: systemProvider,
        serverDetector,
      };
    }

    // Default to macOS (darwin)
    const networkProvider = new MacNetworkProvider();
    const trafficProvider = new MacTrafficProvider();
    const processProvider = new MacProcessProvider(runner);
    const firewallProvider = new MacFirewallProvider();
    const systemProvider = new MacSystemProvider();
    const serverDetector = new MacServerDetector();

    return {
      network: networkProvider,
      traffic: trafficProvider,
      process: processProvider,
      firewall: firewallProvider,
      system: systemProvider,
      serverDetector,
    };
  }
}
