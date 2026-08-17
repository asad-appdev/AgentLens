import { NetworkConnection } from '@network-monitor/shared';

export interface NetworkDiscoveryOptions {
  discoveredAt?: string;
}

export interface IPlatformNetworkProvider {
  /**
   * Discovers all active network connections and listening sockets,
   * enriched with available process and traffic metadata.
   */
  getConnections(options?: NetworkDiscoveryOptions): Promise<NetworkConnection[]>;
}
