import type {
  LocalServerInfo,
  DevServerType,
  KillPortRequest,
  KillPortResult,
  KillProcessesRequest,
  KillProcessesResponse,
} from '@network-monitor/shared';
import type { IPlatformServerDetector } from '../interfaces/server-detector.interface.js';
import { WindowsProcessProvider } from './windows-process.provider.js';
import { WindowsNetworkProvider } from './windows-network.provider.js';
import type { RawProcessInfo } from '../interfaces/process-provider.interface.js';

export class WindowsServerDetector implements IPlatformServerDetector {
  constructor(
    private readonly networkProvider: WindowsNetworkProvider,
    private readonly processProvider: WindowsProcessProvider
  ) {}

  public async discoverLocalServers(): Promise<LocalServerInfo[]> {
    const servers: LocalServerInfo[] = [];

    try {
      const [connections, rawProcesses] = await Promise.all([
        this.networkProvider.getConnections(),
        this.processProvider.getRawProcessList(),
      ]);

      const procMap = new Map<number, RawProcessInfo>(rawProcesses.map((p) => [p.pid, p]));
      const seenKey = new Set<string>();

      for (const conn of connections) {
        if (!conn.isListening || !conn.localPort) continue;

        const pid = conn.pid;
        const port = conn.localPort;
        const dedupeKey = `${pid}-${port}`;
        if (seenKey.has(dedupeKey)) continue;
        seenKey.add(dedupeKey);

        const procMeta = procMap.get(pid);
        const cmdline = procMeta?.args || conn.command || '';
        const ppid = procMeta?.ppid;
        const parentMeta = ppid ? procMap.get(ppid) : undefined;
        const parentProcessName = parentMeta?.comm;
        const procName = procMeta?.comm || conn.processName || 'process';

        const { serverType, isDevServer, confidence, detectionReason } = this.classifyServerType(
          procName,
          cmdline,
          port
        );

        let isSelf = false;
        let selfRole: string | undefined = undefined;
        if (port === 43121 || pid === process.pid) {
          isSelf = true;
          selfRole = 'AgentLens (Backend)';
        } else if (port === 5174 || cmdline.includes('apps/frontend') || cmdline.includes('apps\\frontend')) {
          isSelf = true;
          selfRole = 'AgentLens (Frontend)';
        }

        servers.push({
          pid,
          processName: procName,
          port,
          localAddress: conn.localAddress,
          protocol: 'TCP',
          state: 'LISTEN',
          commandLine: cmdline || undefined,
          ppid: ppid || undefined,
          parentProcessName,
          serverType,
          isDevServer,
          confidence,
          detectionReason,
          isSelf,
          selfRole,
          firstSeenAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-fatal error handling
    }

    return servers.sort((a, b) => a.port - b.port);
  }

  public async killPort(req: KillPortRequest): Promise<KillPortResult> {
    const port = req.port;
    const signal = req.signal || 'SIGTERM';

    const currentPid = await this.resolvePidFromPort(port);
    if (!currentPid) {
      return {
        port,
        pid: 0,
        processName: 'None',
        signalUsed: signal,
        success: false,
        portReleased: true,
        error: `No active listening process found on port ${port}.`,
      };
    }

    // Protect Windows system processes (PID <= 4)
    if (currentPid <= 4) {
      return {
        port,
        pid: currentPid,
        processName: 'System',
        signalUsed: signal,
        success: false,
        portReleased: false,
        error: `Cannot terminate Windows core system process PID ${currentPid}.`,
      };
    }

    const rawList = await this.processProvider.getRawProcessList();
    const procMeta = rawList.find((p) => p.pid === currentPid);
    const cmdline = procMeta?.args || '';
    const procName = procMeta?.comm || 'process';
    const { serverType } = this.classifyServerType(procName, cmdline, port);

    const termRes = await this.processProvider.terminateProcess(currentPid, signal);

    // Wait and verify release
    await new Promise((resolve) => setTimeout(resolve, 300));
    const isStillListening = await this.isPortListening(port);

    return {
      port,
      pid: currentPid,
      processName: procName,
      serverType,
      signalUsed: signal,
      success: termRes.success,
      portReleased: !isStillListening,
      error: !isStillListening ? undefined : 'Process received termination signal but port is still listening.',
    };
  }

  public async killProcesses(req: KillProcessesRequest): Promise<KillProcessesResponse> {
    const results: KillPortResult[] = [];
    const signal = req.signal || 'SIGTERM';

    const pidsToKill = new Set<number>(req.pids || []);
    const portsToKill = new Set<number>(req.ports || []);

    for (const port of portsToKill) {
      const resolvedPid = await this.resolvePidFromPort(port);
      if (resolvedPid) {
        pidsToKill.add(resolvedPid);
      }
    }

    const rawList = await this.processProvider.getRawProcessList();
    const procMap = new Map<number, RawProcessInfo>(rawList.map((p) => [p.pid, p]));

    for (const pid of pidsToKill) {
      if (pid <= 4) continue;

      const procMeta = procMap.get(pid);
      const cmdline = procMeta?.args || '';
      const procName = procMeta?.comm || 'process';
      const associatedPorts = await this.getPortsForPid(pid);
      const { serverType } = this.classifyServerType(procName, cmdline, associatedPorts[0]);

      const termRes = await this.processProvider.terminateProcess(pid, signal);

      await new Promise((resolve) => setTimeout(resolve, 300));
      let anyPortStillListening = false;
      for (const p of associatedPorts) {
        if (await this.isPortListening(p)) {
          anyPortStillListening = true;
          break;
        }
      }

      results.push({
        port: associatedPorts[0] || 0,
        pid,
        processName: procName,
        serverType,
        signalUsed: signal,
        success: termRes.success,
        portReleased: !anyPortStillListening,
        error: !anyPortStillListening ? undefined : 'Port is still in use after termination signal.',
      });
    }

    const allSuccessful = results.length > 0 && results.every((r) => r.success && r.portReleased);
    const portsReleasedCount = results.filter((r) => r.portReleased).length;

    return {
      results,
      allSuccessful,
      portsReleasedCount,
    };
  }

  private async resolvePidFromPort(port: number): Promise<number | null> {
    try {
      const connections = await this.networkProvider.getConnections();
      const match = connections.find((c) => c.isListening && c.localPort === port);
      return match && match.pid > 0 ? match.pid : null;
    } catch {
      return null;
    }
  }

  private async isPortListening(port: number): Promise<boolean> {
    const pid = await this.resolvePidFromPort(port);
    return pid !== null;
  }

  private async getPortsForPid(pid: number): Promise<number[]> {
    try {
      const connections = await this.networkProvider.getConnections();
      return connections
        .filter((c) => c.pid === pid && c.isListening && c.localPort !== null)
        .map((c) => c.localPort as number);
    } catch {
      return [];
    }
  }

  public classifyServerType(
    procName: string,
    cmdline: string,
    port?: number
  ): { serverType: DevServerType; isDevServer: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; detectionReason: string } {
    const combined = `${procName} ${cmdline}`.toLowerCase();

    // 1. Vite
    if (combined.includes('vite') || combined.includes('vite.js')) {
      return {
        serverType: 'Vite',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Command line contains Vite runner and configuration',
      };
    }

    // 2. Next.js
    if (combined.includes('next-server') || combined.includes('next dev') || combined.includes('next start')) {
      return {
        serverType: 'Next.js',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Next.js development server runtime detected',
      };
    }

    // 3. React / Create React App
    if (combined.includes('react-scripts')) {
      return {
        serverType: 'React (CRA)',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Create React App development script detected',
      };
    }

    // 4. Fastify
    if (combined.includes('fastify')) {
      return {
        serverType: 'Node.js / Fastify',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Fastify server runtime detected',
      };
    }

    // 5. NestJS
    if (combined.includes('@nestjs') || combined.includes('nest start')) {
      return {
        serverType: 'Node.js / NestJS',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'NestJS application server detected',
      };
    }

    // 6. Python FastAPI / Uvicorn
    if (combined.includes('uvicorn') && (combined.includes('app') || combined.includes('main:'))) {
      return {
        serverType: 'Python / FastAPI',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Uvicorn ASGI server with FastAPI application detected',
      };
    }

    // 7. Python Django
    if (combined.includes('manage.py runserver') || combined.includes('django')) {
      return {
        serverType: 'Python / Django',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Django manage.py runserver command detected',
      };
    }

    // 8. Python Flask
    if (combined.includes('flask run') || (combined.includes('python') && combined.includes('app.py'))) {
      return {
        serverType: 'Python / Flask',
        isDevServer: true,
        confidence: 'MEDIUM',
        detectionReason: 'Flask web application runtime detected',
      };
    }

    // 9. Python / Uvicorn
    if (combined.includes('uvicorn')) {
      return {
        serverType: 'Python / Uvicorn',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Uvicorn server detected',
      };
    }

    // 10. .NET Development Server
    if (procName.toLowerCase().includes('dotnet') || combined.includes('dotnet watch') || combined.includes('dotnet run')) {
      return {
        serverType: 'Generic Server',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: '.NET development server active',
      };
    }

    // 11. Java Development Server (Spring Boot / Maven / Gradle)
    if (procName.toLowerCase().includes('java') || combined.includes('spring-boot') || combined.includes('mvn') || combined.includes('gradle')) {
      return {
        serverType: 'Generic Server',
        isDevServer: true,
        confidence: 'MEDIUM',
        detectionReason: 'Java application server active',
      };
    }

    // 12. Flutter
    if (combined.includes('flutter_tools') || combined.includes('flutter run')) {
      return {
        serverType: 'Flutter',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Flutter tool development server detected',
      };
    }

    // 13. Ruby on Rails
    if (combined.includes('rails server') || combined.includes('puma')) {
      return {
        serverType: 'Ruby / Rails',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Rails / Puma server detected',
      };
    }

    // 14. PHP / Laravel
    if (combined.includes('artisan serve') || combined.includes('php -s') || combined.includes('php.exe -s')) {
      return {
        serverType: 'PHP / Laravel',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'PHP built-in development server detected',
      };
    }

    // 15. Ollama (AI Runtime)
    if (procName.toLowerCase().includes('ollama') || port === 11434) {
      return {
        serverType: 'Ollama',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'Local Ollama LLM inference service detected',
      };
    }

    // 16. Databases / Infrastructure
    if (procName.toLowerCase().includes('postgres') || port === 5432) {
      return {
        serverType: 'PostgreSQL',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'PostgreSQL database service listening',
      };
    }

    if (procName.toLowerCase().includes('mysqld') || port === 3306) {
      return {
        serverType: 'MySQL',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'MySQL database daemon listening',
      };
    }

    if (procName.toLowerCase().includes('redis') || port === 6379) {
      return {
        serverType: 'Redis',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'Redis in-memory store listening',
      };
    }

    if (procName.toLowerCase().includes('docker') || combined.includes('docker-proxy')) {
      return {
        serverType: 'Docker',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'Docker container port proxy detected',
      };
    }

    // 17. Go or Rust Server
    if (combined.includes('go run') || combined.includes('cargo run')) {
      const serverType = combined.includes('go run') ? 'Go Server' : 'Rust Server';
      return {
        serverType,
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: `${serverType} development session active`,
      };
    }

    // 18. Generic Node / Express (tsx, nodemon, node)
    if (combined.includes('node') || combined.includes('tsx') || combined.includes('ts-node') || combined.includes('nodemon')) {
      const isDev = combined.includes('watch') || combined.includes('nodemon') || combined.includes('dev') || combined.includes('tsx');
      return {
        serverType: 'Node.js / Express',
        isDevServer: isDev,
        confidence: isDev ? 'HIGH' : 'MEDIUM',
        detectionReason: 'Node.js application server listening',
      };
    }

    return {
      serverType: 'Generic Server',
      isDevServer: false,
      confidence: 'LOW',
      detectionReason: `Active listening service (${procName})`,
    };
  }
}
