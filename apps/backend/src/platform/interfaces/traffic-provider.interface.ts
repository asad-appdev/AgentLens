import { TrafficSummary, ProcessTraffic } from '@network-monitor/shared';

export interface IPlatformTrafficProvider {
  /**
   * Samples real-time network traffic throughput rates and returns a global summary.
   */
  sampleTraffic(): Promise<TrafficSummary>;

  /**
   * Retrieves all actively tracked process traffic metrics.
   */
  getAllProcessTraffic(): ProcessTraffic[];

  /**
   * Retrieves specific traffic metrics for a single PID if available.
   */
  getTrafficForPid(pid: number): ProcessTraffic | undefined;
}
