import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  LocalServerInfo,
  DevServerType,
  KillPortRequest,
  KillPortResult,
  KillProcessesRequest,
  KillProcessesResponse,
} from '@network-monitor/shared';
import { MacOSService, macosService } from './macos.service.js';

const execFileAsync = promisify(execFile);

interface ProcessMeta {
  pid: number;
  ppid: number;
  commandLine: string;
}

export class LocalServersService {
  private readonly macos: MacOSService;
  private cachedServers: LocalServerInfo[] = [];
  private lastCacheTime = 0;
  private inFlightDiscovery: Promise<LocalServerInfo[]> | null = null;
  private readonly cacheTtlMs = 2000;

  constructor(macos: MacOSService = macosService) {
    this.macos = macos;
  }

  /**
   * Discovers all active local listening servers and classifies their development server type.
   * Uses single batch execution of `lsof` and `ps` to prevent subprocess lock contention.
   */
  public async discoverLocalServers(): Promise<LocalServerInfo[]> {
    const now = Date.now();
    if (this.cachedServers.length > 0 && now - this.lastCacheTime < this.cacheTtlMs) {
      return this.cachedServers;
    }

    if (this.inFlightDiscovery) {
      return this.inFlightDiscovery;
    }

    this.inFlightDiscovery = this.executeDiscovery().finally(() => {
      this.inFlightDiscovery = null;
    });

    return this.inFlightDiscovery;
  }

  private async executeDiscovery(): Promise<LocalServerInfo[]> {
    const servers: LocalServerInfo[] = [];

    try {
      // 1. Fetch listening sockets and all process metadata concurrently with 2 single commands
      const [lsofResult, psMap] = await Promise.all([
        this.getListeningSocketsOutput(),
        this.getAllProcessesMap(),
      ]);

      const lines = lsofResult.trim().split('\n');
      if (lines.length > 1) {
        const seenKey = new Set<string>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i]?.trim();
          if (!line) continue;

          const parts = line.split(/\s+/);
          if (parts.length < 8) continue;

          let processName = parts[0] || 'Unknown';
          let pid = parseInt(parts[1] || '0', 10);

          // Handle process names containing whitespace by scanning for PID
          if (isNaN(pid) || pid <= 0) {
            const pidIdx = parts.findIndex((p, idx) => idx > 0 && /^\d+$/.test(p));
            if (pidIdx > 0) {
              pid = parseInt(parts[pidIdx] || '0', 10);
              processName = parts.slice(0, pidIdx).join(' ');
            }
          }

          if (isNaN(pid) || pid <= 0) continue;

          // Find address:port field
          let nameField = '';
          for (let j = parts.length - 1; j >= 0; j--) {
            const token = parts[j];
            if (token && token.includes(':') && !token.startsWith('0x')) {
              nameField = token;
              break;
            }
          }

          if (!nameField) continue;

          let localAddress = '127.0.0.1';
          let port = 0;

          const lastColon = nameField.lastIndexOf(':');
          if (lastColon !== -1) {
            const rawHost = nameField.substring(0, lastColon);
            const rawPort = nameField.substring(lastColon + 1);
            port = parseInt(rawPort, 10);
            localAddress = rawHost === '*' || rawHost === '' ? '0.0.0.0' : rawHost;
          }

          if (isNaN(port) || port <= 0) continue;

          const dedupeKey = `${pid}-${port}`;
          if (seenKey.has(dedupeKey)) continue;
          seenKey.add(dedupeKey);

          // 2. Lookup process meta from in-memory map
          const procMeta = psMap.get(pid);
          const cmdline = procMeta?.commandLine || '';
          const ppid = procMeta?.ppid;
          const parentMeta = ppid ? psMap.get(ppid) : undefined;
          const parentProcessName = parentMeta ? parentMeta.commandLine.split(' ')[0] : undefined;

          // 3. Classify server framework type
          const { serverType, isDevServer, confidence, detectionReason } = this.classifyServerType(
            processName,
            cmdline,
            port
          );

          let isSelf = false;
          let selfRole: string | undefined = undefined;
          if (port === 43121 || pid === process.pid) {
            isSelf = true;
            selfRole = 'AgentLens (Backend)';
          } else if (port === 5174 || cmdline.includes('AgentLens/apps/frontend') || cmdline.includes('portScanner/apps/frontend') || cmdline.includes('@network-monitor/frontend')) {
            isSelf = true;
            selfRole = 'AgentLens (Frontend)';
          }

          servers.push({
            pid,
            processName,
            port,
            localAddress,
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
      }
    } catch {
      // If error occurs, fallback to last known good cache if available
      if (this.cachedServers.length > 0) {
        return this.cachedServers;
      }
    }

    if (servers.length > 0) {
      const sorted = servers.sort((a, b) => a.port - b.port);
      this.cachedServers = sorted;
      this.lastCacheTime = Date.now();
      return sorted;
    }

    // If transient lsof issue returned empty but we have cached servers from the last 15 seconds, return them
    if (this.cachedServers.length > 0 && Date.now() - this.lastCacheTime < 15000) {
      return this.cachedServers;
    }

    this.cachedServers = [];
    return [];
  }

  /**
   * Resolves the PID owning a given listening port and terminates the process safely.
   */
  public async killPort(req: KillPortRequest): Promise<KillPortResult> {
    const port = req.port;
    const signal = req.signal || 'SIGTERM';

    // 1. Resolve current PID from listening port
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

    // 2. Verify PID identity
    const psMap = await this.getAllProcessesMap();
    const procMeta = psMap.get(currentPid);
    const cmdline = procMeta?.commandLine || '';
    const procName = cmdline ? cmdline.split(' ')[0] || 'process' : 'process';
    const { serverType } = this.classifyServerType(procName, cmdline, port);

    // Prevent terminating PID 0 or 1 (system init / launchd)
    if (currentPid <= 1) {
      return {
        port,
        pid: currentPid,
        processName: procName,
        serverType,
        signalUsed: signal,
        success: false,
        portReleased: false,
        error: `Cannot terminate system process PID ${currentPid}.`,
      };
    }

    // 3. Terminate the verified process
    const termRes = await this.macos.terminateProcess(currentPid, signal);

    // 4. Wait 300ms and re-check if port was released
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
      error: !isStillListening ? undefined : 'Process received signal but port is still listening.',
    };
  }

  /**
   * Batch terminates multiple PIDs and/or ports with post-cleanup verification.
   */
  public async killProcesses(req: KillProcessesRequest): Promise<KillProcessesResponse> {
    const results: KillPortResult[] = [];
    const signal = req.signal || 'SIGTERM';

    const pidsToKill = new Set<number>(req.pids || []);
    const portsToKill = new Set<number>(req.ports || []);

    // Resolve all ports to PIDs
    for (const port of portsToKill) {
      const resolvedPid = await this.resolvePidFromPort(port);
      if (resolvedPid) {
        pidsToKill.add(resolvedPid);
      }
    }

    const psMap = await this.getAllProcessesMap();

    for (const pid of pidsToKill) {
      if (pid <= 1) continue;

      const procMeta = psMap.get(pid);
      const cmdline = procMeta?.commandLine || '';
      const procName = cmdline ? cmdline.split(' ')[0] || 'process' : 'process';
      const associatedPorts = await this.getPortsForPid(pid);
      const { serverType } = this.classifyServerType(procName, cmdline, associatedPorts[0]);

      const termRes = await this.macos.terminateProcess(pid, signal);

      // Re-check port release
      await new Promise((resolve) => setTimeout(resolve, 200));
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

  /**
   * Fast batch retrieval of all process command lines and PPIDs in a single `ps` call.
   */
  private async getAllProcessesMap(): Promise<Map<number, ProcessMeta>> {
    const map = new Map<number, ProcessMeta>();
    try {
      const { stdout } = await execFileAsync('ps', ['-A', '-o', 'pid=,ppid=,command='], {
        timeout: 6000,
        maxBuffer: 10 * 1024 * 1024,
      });

      const lines = stdout.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (match && match[1] && match[2] && match[3]) {
          const pid = parseInt(match[1], 10);
          const ppid = parseInt(match[2], 10);
          const commandLine = match[3].trim();
          if (!isNaN(pid)) {
            map.set(pid, { pid, ppid, commandLine });
          }
        }
      }
    } catch {
      // Return whatever map was populated
    }
    return map;
  }

  private async getListeningSocketsOutput(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P'], {
        timeout: 6000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Resolves the current PID listening on a given port.
   */
  private async resolvePidFromPort(port: number): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-iTCP:' + port, '-sTCP:LISTEN', '-n', '-P'], { timeout: 6000 });
      const lines = stdout.trim().split('\n');
      if (lines.length <= 1) return null;
      const parts = lines[1]?.split(/\s+/);
      const pid = parseInt(parts?.[1] || '0', 10);
      return isNaN(pid) || pid <= 0 ? null : pid;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a port is currently in LISTEN state.
   */
  private async isPortListening(port: number): Promise<boolean> {
    if (port <= 0) return false;
    const pid = await this.resolvePidFromPort(port);
    return pid !== null;
  }

  /**
   * Gets all listening ports owned by a PID.
   */
  private async getPortsForPid(pid: number): Promise<number[]> {
    try {
      const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-iTCP', '-sTCP:LISTEN', '-n', '-P'], {
        timeout: 3000,
      });
      const ports: number[] = [];
      const lines = stdout.trim().split('\n');
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i]?.split(/\s+/);
        const nameField = parts?.[parts.length - 2] || parts?.[parts.length - 1];
        if (nameField) {
          const lastColon = nameField.lastIndexOf(':');
          if (lastColon !== -1) {
            const p = parseInt(nameField.substring(lastColon + 1), 10);
            if (!isNaN(p) && p > 0) ports.push(p);
          }
        }
      }
      return ports;
    } catch {
      return [];
    }
  }

  /**
   * Classifies server type and dev server status by inspecting command line, process name, and ports.
   */
  private classifyServerType(
    procName: string,
    cmdline: string,
    port?: number
  ): { serverType: DevServerType; isDevServer: boolean; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; detectionReason: string } {
    const combined = `${procName} ${cmdline}`.toLowerCase();

    // 1. Vite
    if (combined.includes('vite') || combined.includes('bin/vite')) {
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
    if (combined.includes('manage.py runserver')) {
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

    // 10. Flutter
    if (combined.includes('flutter_tools') || combined.includes('flutter run')) {
      return {
        serverType: 'Flutter',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Flutter tool development server detected',
      };
    }

    // 11. Ruby on Rails
    if (combined.includes('rails server') || combined.includes('puma')) {
      return {
        serverType: 'Ruby / Rails',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'Rails / Puma server detected',
      };
    }

    // 12. PHP / Laravel
    if (combined.includes('artisan serve') || combined.includes('php -s')) {
      return {
        serverType: 'PHP / Laravel',
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: 'PHP built-in development server detected',
      };
    }

    // 13. Ollama (AI Runtime)
    if (procName.toLowerCase().includes('ollama') || port === 11434) {
      return {
        serverType: 'Ollama',
        isDevServer: false,
        confidence: 'HIGH',
        detectionReason: 'Local Ollama LLM inference service detected',
      };
    }

    // 14. Databases / Infrastructure
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

    // 15. Go or Rust Server
    if (combined.includes('go run') || combined.includes('cargo run')) {
      const serverType = combined.includes('go run') ? 'Go Server' : 'Rust Server';
      return {
        serverType,
        isDevServer: true,
        confidence: 'HIGH',
        detectionReason: `${serverType} development session active`,
      };
    }

    // 16. Generic Node / Express (tsx, nodemon, node)
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

export const localServersService = new LocalServersService();
