import {
  SecurityInvestigationResult,
  SecurityEvidencePackage,
  SecurityAlert,
} from '@network-monitor/shared';
import { securityAlertsService, SecurityAlertsService } from '../alerts/security-alerts.service.js';
import { settingsService, SettingsService } from '../../services/settings.service.js';
import { logger } from '../../services/logger.service.js';
import http from 'node:http';

export class SecurityInvestigatorService {
  private readonly alerts: SecurityAlertsService;
  private readonly settings: SettingsService;

  constructor(
    alerts: SecurityAlertsService = securityAlertsService,
    settings: SettingsService = settingsService
  ) {
    this.alerts = alerts;
    this.settings = settings;
  }

  /**
   * Prepares a privacy-sanitized metadata evidence package for an alert or incident.
   * STRICT GUARANTEE: NEVER includes file contents or secret keys.
   */
  public prepareSanitizedEvidencePackage(alert: SecurityAlert): SecurityEvidencePackage {
    return {
      incidentOrAlertId: alert.id,
      title: alert.title,
      agentId: alert.agentId,
      agentName: alert.agentName,
      pid: alert.pid,
      processName: alert.processName,
      timeline: [
        {
          timestamp: alert.timestamp,
          event: alert.whySuspicious,
          severity: alert.severity,
        },
      ],
      processesInvolved: [{ pid: alert.pid, name: alert.processName }],
      networkDestinations: [],
      sensitiveResources: [],
      isSanitized: true, // Guaranteed zero file contents or credentials
    };
  }

  /**
   * Investigates a security alert or finding using optional local LLM or deterministic fallback.
   */
  public async investigate(targetId: string, userQuestion?: string): Promise<SecurityInvestigationResult> {
    const activeAlerts = this.alerts.getActiveAlerts();
    const targetAlert = activeAlerts.find((a) => a.id === targetId || a.agentId === targetId);

    const title = targetAlert ? targetAlert.title : 'General Security Investigation';
    const agentName = targetAlert?.agentName || targetAlert?.processName || 'Unknown Process';
    const evidenceList = targetAlert?.evidence || ['No specific alert evidence recorded'];
    const whySuspicious = targetAlert?.whySuspicious || 'Observed activity pattern deviated from historical baseline.';
    const whatIsUnknown = targetAlert?.whatIsUnknown || 'Whether encrypted payload contents contained sensitive data.';
    const rec = targetAlert?.recommendation || 'Verify destination domain and process command before taking action.';

    // 1. Check configured LLM Provider in Settings
    const userSettings = this.settings.getSettings();
    const provider = (userSettings as any).ai_analyst_provider || 'ollama';
    const isEnabled = (userSettings as any).ai_analyst_enabled !== false;

    if (!isEnabled || provider === 'disabled') {
      return {
        investigationId: `inv-${Date.now()}`,
        targetId,
        timestamp: new Date().toISOString(),
        providerUsed: 'disabled',
        observedFacts: [
          `Target: ${agentName} (PID ${targetAlert?.pid || 'N/A'})`,
          `Finding: ${title}`,
          ...evidenceList,
        ],
        inferences: [whySuspicious],
        whatCannotBeConfirmed: [whatIsUnknown],
        recommendedActions: [rec],
        naturalLanguageSummary: `AI Investigator is currently disabled in Settings. Local deterministic security correlation remains fully active. ${rec}`,
      };
    }

    // 2. Deterministic Semantic Engine Fallback
    const fallbackResult: SecurityInvestigationResult = {
      investigationId: `inv-${Date.now()}`,
      targetId,
      timestamp: new Date().toISOString(),
      providerUsed: 'semantic-engine',
      observedFacts: [
        `Process Name: ${agentName} (PID: ${targetAlert?.pid || 'N/A'})`,
        `Primary Alert: ${title}`,
        ...evidenceList.map((e) => `Observable Signal: ${e}`),
      ],
      inferences: [
        whySuspicious,
        'Temporal proximity between resource access and network communication increases exposure probability.',
      ],
      whatCannotBeConfirmed: [
        whatIsUnknown,
        'Application-layer TLS encryption prevents inspecting outbound request bodies without local proxy certs.',
      ],
      recommendedActions: [
        rec,
        'Inspect parent process command line using Process Inspector.',
        'Use Firewall tab to temporarily block destination if endpoint is unverified.',
      ],
      naturalLanguageSummary: `Analysis of ${agentName}: ${whySuspicious}\n\nEvidence observed:\n${evidenceList.map((e) => `• ${e}`).join('\n')}\n\nNote: ${whatIsUnknown}\n\nRecommended next step: ${rec}`,
    };

    // 3. Attempt Ollama if selected and available
    if (provider === 'ollama') {
      try {
        const ollamaHost = (userSettings as any).ai_analyst_ollama_host || 'http://127.0.0.1:11434';
        const ollamaModel = (userSettings as any).ai_analyst_ollama_model || 'llama3:latest';


        const prompt = `You are Agent Lens Security Investigator. Analyze this security evidence package.
Do NOT accuse without evidence.
Return response formatted in these 4 explicit sections:
1. OBSERVED FACTS
2. INFERENCES
3. WHAT CANNOT BE CONFIRMED
4. RECOMMENDED ACTIONS

Security Finding: ${title}
Agent: ${agentName}
Evidence:
${evidenceList.join('\n')}
Why Suspicious: ${whySuspicious}
User Question: ${userQuestion || 'Why is this activity flagged as suspicious?'}
`;

        const llmResponse = await this.queryOllama(ollamaHost, ollamaModel, prompt);
        if (llmResponse) {
          fallbackResult.providerUsed = 'ollama';
          fallbackResult.naturalLanguageSummary = llmResponse;
        }
      } catch (err) {
        logger.warn(`[SecurityInvestigatorService] Ollama query unavailable, using deterministic analysis: ${err}`);
      }
    }

    return fallbackResult;
  }

  private async queryOllama(host: string, model: string, prompt: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        const parsedUrl = new URL(`${host}/api/generate`);
        const payload = JSON.stringify({ model, prompt, stream: false });

        const req = http.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 11434,
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 5000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              if (res.statusCode === 200) {
                try {
                  const json = JSON.parse(data);
                  resolve(json.response || null);
                } catch {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          }
        );

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
        req.write(payload);
        req.end();
      } catch {
        resolve(null);
      }
    });
  }
}

export const securityInvestigatorService = new SecurityInvestigatorService();
