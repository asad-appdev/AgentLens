import {
  AiAgentDetectionResult,
  AiConfidenceGrade,
  AiDetectionSourceType,
} from '@network-monitor/shared';
import { AiAgentRegistry, aiAgentRegistry } from './ai-agent-registry.js';
import { SettingsService, settingsService } from '../../services/settings.service.js';

const GENERIC_PROCESS_NAMES = new Set([
  'node',
  'node.exe',
  'python',
  'python3',
  'python.exe',
  'electron',
  'electron.exe',
  'bash',
  'zsh',
  'sh',
  'powershell',
  'powershell.exe',
  'cmd',
  'cmd.exe',
]);

export class AiAgentDetector {
  private readonly registry: AiAgentRegistry;
  private readonly settings: SettingsService;

  constructor(registry: AiAgentRegistry = aiAgentRegistry, settings: SettingsService = settingsService) {
    this.registry = registry;
    this.settings = settings;
  }

  public detect(
    pid: number,
    processName: string,
    commandLine?: string,
    localPorts: number[] = [],
    executablePath?: string,
    parentProcessName?: string
  ): AiAgentDetectionResult | null {
    // 1. Check manual user label override
    const customLabel = this.settings.getProcessLabel(processName) || this.settings.getProcessLabel(pid.toString());
    if (customLabel && customLabel.toLowerCase().includes('ai')) {
      return {
        agentId: `custom-${processName.toLowerCase()}`,
        displayName: customLabel,
        category: 'custom',
        confidence: 'MANUAL',
        confidenceScore: 1.0,
        evidence: ['User manual custom label: ' + customLabel],
        detectionSources: ['manual'],
        isLocalServer: localPorts.length > 0,
        listeningPort: localPorts[0],
        matchedPid: pid,
        processName,
        executablePath,
        commandLine,
      };
    }

    const isGenericProc = GENERIC_PROCESS_NAMES.has(processName.toLowerCase());

    // 2. Check known registry signatures
    const match = this.registry.matchProcess(processName, commandLine, localPorts, executablePath);
    if (match) {
      const { agent, sources, evidence } = match;

      // Calculate quantitative confidence score (0.0 to 1.0)
      let confidenceScore = 0.5;

      // Generic runtimes MUST have secondary evidence (command line or distinctive executable/parent)
      if (isGenericProc && sources.length === 1 && (sources[0] === 'process-name' || sources[0] === 'known-port')) {
        return null; // Reject generic node/python process without agent-specific command line
      }

      const sourcesList: AiDetectionSourceType[] = [...sources];

      if (sources.includes('known-port')) confidenceScore += 0.3;
      if (sources.includes('command-pattern')) confidenceScore += 0.35;
      if (sources.includes('executable')) confidenceScore += 0.25;
      if (sources.includes('process-name') && !isGenericProc) confidenceScore += 0.25;

      if (parentProcessName && parentProcessName.toLowerCase().includes(agent.id)) {
        sourcesList.push('parent-process');
        evidence.push(`Spawned by recognized AI parent process: ${parentProcessName}`);
        confidenceScore += 0.15;
      }

      confidenceScore = Math.min(0.99, Math.max(0.1, Number(confidenceScore.toFixed(2))));

      // If confidence is below threshold, reject false positive
      if (confidenceScore < 0.6) {
        return null;
      }

      let confidence: AiConfidenceGrade = 'LOW';
      if (confidenceScore >= 0.85) {
        confidence = 'HIGH';
      } else if (confidenceScore >= 0.65) {
        confidence = 'MEDIUM';
      }

      return {
        agentId: agent.id,
        displayName: agent.displayName,
        category: agent.category,
        confidence,
        confidenceScore,
        evidence,
        detectionSources: sourcesList,
        isLocalServer: agent.category === 'local-runtime' || agent.category === 'web-ui',
        listeningPort: localPorts.find((p) => agent.knownPorts?.includes(p)) || localPorts[0],
        matchedPid: pid,
        processName,
        executablePath,
        commandLine,
      };

    }

    return null;
  }
}

export const aiAgentDetector = new AiAgentDetector();
