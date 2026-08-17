import {
  AiAgentProfile,
  NetworkRelationshipGraphData,
  AiAgentComparisonStat,
  NetworkProtocol,
} from '@network-monitor/shared';
import { platformService } from '../../platform/platform.service.js';
import { HistoryService, historyService } from '../../services/history.service.js';
import { AiAgentRegistry, aiAgentRegistry } from './ai-agent-registry.js';
import { AiAgentDetector, aiAgentDetector } from './ai-agent-detector.js';
import { AiAgentSessionService, aiAgentSessionService } from './ai-session.service.js';

export const KNOWN_TRUSTED_DOMAINS: Record<string, { provider: string; category: string }> = {
  'api.anthropic.com': { provider: 'Anthropic', category: 'ai-api' },
  'claude.ai': { provider: 'Anthropic', category: 'ai-web' },
  'api.openai.com': { provider: 'OpenAI', category: 'ai-api' },
  'chatgpt.com': { provider: 'OpenAI', category: 'ai-web' },
  'generativelanguage.googleapis.com': { provider: 'Google', category: 'ai-api' },
  'aiplatform.googleapis.com': { provider: 'Google', category: 'ai-api' },
  'cloudcode-pa.googleapis.com': { provider: 'Google Antigravity', category: 'ai-api' },
  'daily-cloudcode-pa.googleapis.com': { provider: 'Google Antigravity', category: 'ai-api' },
  'cursor.sh': { provider: 'Cursor', category: 'ai-api' },
  'api2.cursor.sh': { provider: 'Cursor', category: 'ai-api' },
  'codeium.com': { provider: 'Windsurf', category: 'ai-api' },
  'api.githubcopilot.com': { provider: 'GitHub Copilot', category: 'ai-api' },
  'github.com': { provider: 'GitHub', category: 'code-repo' },
  'api.github.com': { provider: 'GitHub', category: 'code-repo' },
  'raw.githubusercontent.com': { provider: 'GitHub', category: 'code-repo' },
  'registry.npmjs.org': { provider: 'npm', category: 'package-registry' },
  'registry.yarnpkg.com': { provider: 'yarn', category: 'package-registry' },
  'pypi.org': { provider: 'PyPI', category: 'package-registry' },
  'files.pythonhosted.org': { provider: 'PyPI', category: 'package-registry' },
  'crates.io': { provider: 'crates.io', category: 'package-registry' },
  'proxy.golang.org': { provider: 'Go', category: 'package-registry' },
  'huggingface.co': { provider: 'Hugging Face', category: 'model-hub' },
  'ollama.com': { provider: 'Ollama', category: 'model-hub' },
  'ollama.ai': { provider: 'Ollama', category: 'model-hub' },
  'localhost': { provider: 'Localhost', category: 'loopback' },
  '127.0.0.1': { provider: 'Localhost', category: 'loopback' },
  '::1': { provider: 'Localhost', category: 'loopback' },
};

export class AiAgentNetworkService {
  private readonly history: HistoryService;
  private readonly registry: AiAgentRegistry;
  private readonly detector: AiAgentDetector;
  private readonly sessionService: AiAgentSessionService;
  private observedAgentDestinations = new Map<string, Set<string>>(); // agentId -> Set of hosts

  constructor(
    history: HistoryService = historyService,
    registry: AiAgentRegistry = aiAgentRegistry,
    detector: AiAgentDetector = aiAgentDetector,
    sessionService: AiAgentSessionService = aiAgentSessionService
  ) {
    this.history = history;
    this.registry = registry;
    this.detector = detector;
    this.sessionService = sessionService;
  }

  /**
   * Classifies a network destination host or IP.
   */
  public classifyDestination(
    destination: string,
    agentId?: string
  ): {
    isKnownTrusted: boolean;
    providerName?: string;
    category?: string;
    isLocal: boolean;
    isUnseen: boolean;
  } {
    const destLower = (destination || '').toLowerCase().trim();
    const isLocal = destLower === '127.0.0.1' || destLower === '::1' || destLower === 'localhost' || destLower.startsWith('127.');

    let isKnownTrusted = false;
    let providerName: string | undefined;
    let category: string | undefined;

    for (const [domain, info] of Object.entries(KNOWN_TRUSTED_DOMAINS)) {
      if (destLower === domain || destLower.endsWith('.' + domain)) {
        isKnownTrusted = true;
        providerName = info.provider;
        category = info.category;
        break;
      }
    }

    let isUnseen = false;
    if (agentId && !isLocal) {
      let knownSet = this.observedAgentDestinations.get(agentId);
      if (!knownSet) {
        knownSet = new Set<string>();
        this.observedAgentDestinations.set(agentId, knownSet);
      }
      if (!knownSet.has(destLower) && !isKnownTrusted) {
        isUnseen = true;
      }
      knownSet.add(destLower);
    }

    return {
      isKnownTrusted,
      providerName,
      category,
      isLocal,
      isUnseen,
    };
  }

  /**
   * Generates AI agent profiles across all known and observed agents using cross-platform providers.
   */
  public async getAiAgentProfiles(): Promise<AiAgentProfile[]> {
    const networkProvider = platformService.getNetworkProvider();
    const trafficProvider = platformService.getTrafficProvider();

    const connections = await networkProvider.getConnections();
    const trafficSnapshot = await trafficProvider.sampleTraffic();
    const trafficList = trafficSnapshot.processes || [];
    const definitions = this.registry.getAll();

    const profiles: AiAgentProfile[] = [];

    for (const def of definitions) {
      // Find matching active connections and live traffic processes
      const matchingConns = connections.filter((c) => {
        const detected = this.detector.detect(
          c.pid,
          c.processName,
          c.command,
          c.localPort !== null ? [c.localPort] : []
        );
        return detected?.agentId === def.id ||
          c.aiAgentName?.toLowerCase().includes(def.id) ||
          c.aiAgentName?.toLowerCase().includes(def.displayName.toLowerCase());
      });

      const matchingTraffic = trafficList.filter((t) => {
        const detected = this.detector.detect(
          t.pid,
          t.processName,
          undefined,
          []
        );
        return detected?.agentId === def.id ||
          t.aiAgentName?.toLowerCase().includes(def.id) ||
          t.aiAgentName?.toLowerCase().includes(def.displayName.toLowerCase());
      });

      const uniquePids = Array.from(new Set([
        ...matchingConns.map((c) => c.pid),
        ...matchingTraffic.map((t) => t.pid),
      ]));

      const currentDown = matchingTraffic.reduce((acc, t) => acc + t.bytesInPerSecond, 0);
      const currentUp = matchingTraffic.reduce((acc, t) => acc + t.bytesOutPerSecond, 0);

      const uniqueRemoteIps = Array.from(
        new Set(matchingConns.map((c) => c.remoteAddress).filter((ip): ip is string => Boolean(ip) && ip !== '*'))
      );

      // Track destinations
      for (const ip of uniqueRemoteIps) {
        this.classifyDestination(ip, def.id);
      }

      const sessions = this.sessionService.getSessionsForAgent(def.id);
      const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');

      const isObserved = uniquePids.length > 0;
      const status = isObserved ? (currentDown + currentUp > 1024 ? 'ACTIVE' : 'IDLE') : 'NOT_OBSERVED';

      // History aggregation
      const histData = this.history.getProcessDetail(uniquePids[0] || 0);

      profiles.push({
        agentId: def.id,
        displayName: def.displayName,
        category: def.category,
        status,
        confidence: isObserved ? 'HIGH' : 'LOW',
        detectionSources: isObserved ? ['process-name'] : [],
        processCount: uniquePids.length,
        activeSessionsCount: activeSessions.length,
        connectionsCount: matchingConns.length,
        remoteHostsCount: uniqueRemoteIps.length,
        downloadBytes: histData?.totalDownloadedBytes || currentDown * 60,
        uploadBytes: histData?.totalUploadedBytes || currentUp * 60,
        currentDownloadRate: currentDown,
        currentUploadRate: currentUp,
        runtimeMinutes: isObserved ? Math.max(1, Math.round(process.uptime() / 60)) : 0,
        observedStart: histData?.firstSeen || new Date().toISOString(),
        lastObserved: histData?.lastSeen || new Date().toISOString(),
        isLocalService: def.category === 'local-runtime' || def.category === 'web-ui',
        listeningPorts: def.knownPorts || [],
        pids: uniquePids,
        recentEndpoints: uniqueRemoteIps.map((ip) => {
          const conn = matchingConns.find((c) => c.remoteAddress === ip);
          return {
            ip,
            port: conn?.remotePort || 443,
            protocol: (conn?.protocol as NetworkProtocol) || 'TCP',
            bytes: 0,
            lastSeen: new Date().toISOString(),
          };
        }),
      });
    }

    return profiles;
  }

  /**
   * Builds the interactive Network Relationship Graph for an agent.
   */
  public async getAgentGraph(agentId: string): Promise<NetworkRelationshipGraphData> {
    return this.getNetworkRelationshipGraph(agentId);
  }

  public async getNetworkRelationshipGraph(agentId: string): Promise<NetworkRelationshipGraphData> {

    const networkProvider = platformService.getNetworkProvider();
    const connections = await networkProvider.getConnections();
    const def = this.registry.getById(agentId);

    const matchingConns = connections.filter((c) => {
      const detected = this.detector.detect(
        c.pid,
        c.processName,
        c.command,
        c.localPort !== null ? [c.localPort] : []
      );
      return detected?.agentId === agentId || c.aiAgentName?.toLowerCase().includes(agentId);
    });

    const nodes: NetworkRelationshipGraphData['nodes'] = [];
    const edges: NetworkRelationshipGraphData['edges'] = [];

    const agentNodeId = `agent-${agentId}`;
    nodes.push({
      id: agentNodeId,
      label: def?.displayName || agentId,
      type: 'agent',
      status: matchingConns.length > 0 ? 'active' : 'inactive',
    });

    const addedPids = new Set<number>();
    const addedEndpoints = new Set<string>();

    for (const conn of matchingConns) {
      const procNodeId = `proc-${conn.pid}`;
      if (!addedPids.has(conn.pid)) {
        addedPids.add(conn.pid);
        nodes.push({
          id: procNodeId,
          label: `${conn.processName} (${conn.pid})`,
          type: 'process',
        });
        edges.push({
          source: agentNodeId,
          target: procNodeId,
          label: 'owns',
        });
      }

      if (conn.remoteAddress && conn.remoteAddress !== '*') {
        const destClassification = this.classifyDestination(conn.remoteAddress, agentId);
        const epNodeId = `ep-${conn.remoteAddress}:${conn.remotePort || 443}`;
        if (!addedEndpoints.has(epNodeId)) {
          addedEndpoints.add(epNodeId);
          nodes.push({
            id: epNodeId,
            label: `${destClassification.providerName || conn.remoteAddress}:${conn.remotePort || 443}${destClassification.isUnseen ? ' ⚠' : ''}`,
            type: 'endpoint',
            metadata: {
              isTrusted: destClassification.isKnownTrusted,
              isUnseen: destClassification.isUnseen,
            },
          });
        }
        edges.push({
          source: procNodeId,
          target: epNodeId,
          label: 'connects-to',
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Generates comparison metrics across observed AI agents.
   */
  public async getAgentComparisonStats(): Promise<AiAgentComparisonStat[]> {
    const profiles = await this.getAiAgentProfiles();
    return profiles.map((p) => ({
      agentId: p.agentId,
      displayName: p.displayName,
      runtimeMinutes: p.runtimeMinutes,
      connectionsCount: p.connectionsCount,
      downloadBytes: p.downloadBytes,
      uploadBytes: p.uploadBytes,
      remoteHostsCount: p.remoteHostsCount,
      activeProcesses: p.processCount,
    }));
  }
}

export const aiAgentNetworkService = new AiAgentNetworkService();
