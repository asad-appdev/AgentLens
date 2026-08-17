import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  AnalystConfig,
  AnalystMessage,
  AnalystQueryResponse,
  OllamaModelInfo,
  AnalystActionSuggestion,
  AnalystContextSummary,
} from '@network-monitor/shared';
import { AnalystContextService, analystContextService } from './analyst-context.service.js';
import { actionPreparationService, ActionPreparationService } from '../automation/action-preparation.service.js';
import { watchRulesService, WatchRulesService } from '../automation/watch-rules.service.js';
import { formatBytesPerSec } from '../utils/formatters.js';

export class LocalAiAnalystService {
  private config: AnalystConfig;
  private readonly configPath: string;
  private readonly contextService: AnalystContextService;
  private readonly actionService: ActionPreparationService;
  private readonly watchService: WatchRulesService;

  constructor(
    contextService: AnalystContextService = analystContextService,
    actionService: ActionPreparationService = actionPreparationService,
    watchService: WatchRulesService = watchRulesService,
    storageDir?: string
  ) {
    this.contextService = contextService;
    this.actionService = actionService;
    this.watchService = watchService;
    const baseDir = storageDir || path.join(os.homedir(), '.network-monitor');
    this.configPath = path.join(baseDir, 'analyst-config.json');

    this.config = {
      provider: 'ollama',
      ollamaEndpoint: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.2:latest',
      temperature: 0.2,
    };

    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = { ...this.config, ...parsed };
      }
    } catch {
      // ignore
    }
  }

  public saveConfig(newConfig: Partial<AnalystConfig>): AnalystConfig {
    this.config = { ...this.config, ...newConfig };
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch {
      // ignore
    }
    return this.config;
  }

  public getConfig(): AnalystConfig {
    return { ...this.config };
  }

  /**
   * Probe available models from local Ollama endpoint.
   */
  public async getAvailableOllamaModels(): Promise<OllamaModelInfo[]> {
    try {
      const res = await fetch(`${this.config.ollamaEndpoint}/api/tags`, { method: 'GET' });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string; size: number; modified_at: string }> };
      return (data.models || []).map((m) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Processes a natural language query using the configured LLM provider or local fallback.
   */
  public async answerQuery(query: string, _history: AnalystMessage[] = []): Promise<AnalystQueryResponse> {
    const { summary, systemPromptContext } = await this.contextService.getContextSummary();

    if (this.config.provider === 'disabled') {
      const reply: AnalystMessage = {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: 'The AI Network Analyst is currently disabled. You can enable it in Settings or select local Ollama.',
        timestamp: new Date().toISOString(),
      };
      return { reply, providerUsed: 'disabled' };
    }

    // Check for explicit action intents (e.g. "Block IP", "Investigate", "Watch", "Filter")
    const actionResult = this.handleDirectActionIntent(query, summary);
    if (actionResult) {
      return {
        reply: {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: actionResult.text,
          timestamp: new Date().toISOString(),
          suggestedActions: actionResult.suggestions,
          contextSnapshot: summary,
          modelUsed: 'Local AI Action Assistant',
        },
        providerUsed: 'fallback',
      };
    }

    // 1. Attempt Ollama if selected
    if (this.config.provider === 'ollama') {
      try {
        const ollamaReply = await this.queryOllama(query, systemPromptContext);
        if (ollamaReply) {
          const suggestions = this.extractActionSuggestions(query, ollamaReply, summary);
          const reply: AnalystMessage = {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: ollamaReply,
            timestamp: new Date().toISOString(),
            suggestedActions: suggestions,
            contextSnapshot: summary,
            modelUsed: `Ollama (${this.config.ollamaModel})`,
          };
          return { reply, providerUsed: 'ollama' };
        }
      } catch {
        // Fall back to rule-based offline analyst
      }
    }

    // 2. Attempt OpenAI if selected and key provided
    if (this.config.provider === 'openai' && this.config.openaiApiKey) {
      try {
        const openaiReply = await this.queryOpenAi(query, systemPromptContext);
        if (openaiReply) {
          const suggestions = this.extractActionSuggestions(query, openaiReply, summary);
          const reply: AnalystMessage = {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: openaiReply,
            timestamp: new Date().toISOString(),
            suggestedActions: suggestions,
            contextSnapshot: summary,
            modelUsed: `OpenAI (${this.config.openaiModel || 'gpt-4o-mini'})`,
          };
          return { reply, providerUsed: 'openai' };
        }
      } catch {
        // Fall back to rule-based offline analyst
      }
    }

    // 3. Rule-Based Local Offline Analyst
    const fallbackText = this.generateFallbackAnswer(query, summary);
    const suggestions = this.extractActionSuggestions(query, fallbackText, summary);

    const reply: AnalystMessage = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: fallbackText,
      timestamp: new Date().toISOString(),
      suggestedActions: suggestions,
      contextSnapshot: summary,
      modelUsed: 'Local Rule-Based Analyst (Offline)',
    };

    return { reply, providerUsed: 'fallback' };
  }

  /**
   * Directly handles actionable automation intents (block, investigate, watch, filter).
   */
  private handleDirectActionIntent(
    query: string,
    summary: AnalystContextSummary
  ): { text: string; suggestions: AnalystActionSuggestion[] } | null {
    const q = query.toLowerCase();

    // 1. IP Blocking Request Intent
    if (q.includes('block') && (q.includes('ip') || q.includes('endpoint') || q.includes('connection'))) {
      const ipMatch = query.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      const targetIp = ipMatch ? ipMatch[0] : (summary.recentNewEndpoints[0]?.split(':')[0] || '142.250.72.14');
      const prepared = this.actionService.prepareBlockIp(
        targetIp,
        `User requested block via AI Analyst: "${query}"`,
        summary.topProcesses[0]?.name || 'Unknown'
      );

      return {
        text: `I found endpoint **${targetIp}** associated with active network traffic. I have prepared a firewall drop rule in the dedicated anchor \`com.networkmonitor.app\`.\n\n**Impact Preview:** Dropping all future inbound/outbound packets to \`${targetIp}\`.\n\nPlease review and confirm to apply:`,
        suggestions: [
          { label: `Review & Block ${targetIp}`, actionType: 'view_ip', target: prepared.target },
          { label: 'Cancel', actionType: 'filter_traffic', target: 'all' },
        ],
      };
    }

    // 2. Investigation Creation Request Intent
    if (q.includes('investigate')) {
      const agentTarget = summary.activeAiAgents.find((a) => q.includes(a.toLowerCase())) || 'Active AI Agents';
      const prepared = this.actionService.prepareCreateInvestigation(
        `Investigation: ${agentTarget} Analysis`,
        `Automated investigation created from AI prompt: "${query}"`,
        summary.topProcesses.map((p) => ({ type: 'process', targetId: String(p.pid), title: `${p.name} (PID ${p.pid})` }))
      );

      return {
        text: `I have prepared a new local investigation workspace: **"${prepared.title}"** with **${summary.topProcesses.length} pinned processes** and relevant remote endpoint snapshots.`,
        suggestions: [
          { label: 'Open Investigation Workspace', actionType: 'open_investigation', target: prepared.id },
        ],
      };
    }

    // 3. Watch Rule Intent
    if (q.includes('watch') || q.includes('notify me when')) {
      const target = summary.activeAiAgents[0] || 'Claude Code';
      this.watchService.createRule({
        name: `${target} Automated Watch`,
        targetType: 'agent',
        targetName: target,
        triggerType: q.includes('traffic') ? 'HIGH_THROUGHPUT' : 'NEW_ENDPOINT',
        action: 'NOTIFY',
      });

      return {
        text: `✅ Added automated watch rule for **${target}**.\n* Trigger: **${q.includes('traffic') ? 'High Throughput (> 10 MB/s)' : 'New Remote Endpoint'}**\n* Action: **Local Notification**\n\nThis rule will automatically evaluate non-destructively in the background.`,
        suggestions: [
          { label: 'View Watch Rules', actionType: 'open_investigation', target: 'watch_rules' },
        ],
      };
    }

    // 4. Natural-Language Filter Intent
    if (q.includes('show connections') || q.includes('show processes') || q.includes('filter')) {
      const nlFilter = this.actionService.parseNaturalLanguageFilter(query);
      return {
        text: `Applied natural language filter criteria:\n* **AI Only:** ${nlFilter.isAiOnly ? 'Yes' : 'No'}\n* **Min Throughput:** ${nlFilter.minThroughputBytesPerSec ? formatBytesPerSec(nlFilter.minThroughputBytesPerSec) : 'Any'}\n* **Protocol:** ${nlFilter.protocol || 'All'}\n\nSwitching to the Sockets view with this filter applied.`,
        suggestions: [
          { label: 'View Filtered Sockets', actionType: 'filter_traffic', target: 'filtered' },
        ],
      };
    }

    return null;
  }

  private async queryOllama(query: string, systemPromptContext: string): Promise<string | null> {
    const prompt = `You are the local macOS Network Analyst. You analyze live local network sockets, bandwidth rates, AI agents, and traffic observations.
Analyze strictly using the provided context. Use neutral observability terminology. Do not make up facts. Keep answers concise, factual, and informative.

CONTEXT:
${systemPromptContext}

USER QUESTION:
${query}`;

    const res = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.ollamaModel,
        prompt,
        stream: false,
        options: { temperature: this.config.temperature || 0.2 },
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim() || null;
  }

  private async queryOpenAi(query: string, systemPromptContext: string): Promise<string | null> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.openaiModel || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are the local macOS Network Analyst. You analyze local network sockets, bandwidth, and AI agents strictly using this data:\n${systemPromptContext}`,
          },
          { role: 'user', content: query },
        ],
        temperature: this.config.temperature || 0.2,
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  /**
   * Rule-based local semantic response generator when no LLM server is reachable.
   */
  private generateFallbackAnswer(query: string, summary: AnalystContextSummary): string {
    const q = query.toLowerCase();

    // 1. Bandwidth / Traffic Questions
    if (q.includes('bandwidth') || q.includes('most traffic') || q.includes('highest traffic') || q.includes('using the most')) {
      if (summary.topProcesses.length === 0) {
        return `Current network bandwidth throughput is **${formatBytesPerSec(summary.totalDownloadRate + summary.totalUploadRate)}**. There are no heavy processes transferring data right now.`;
      }
      const top = summary.topProcesses[0];
      if (top) {
        const totalRate = top.downloadRate + top.uploadRate;
        return `**${top.name} (PID ${top.pid})** is generating the most bandwidth right now, consuming **${formatBytesPerSec(totalRate)}** (↓ ${formatBytesPerSec(top.downloadRate)} / ↑ ${formatBytesPerSec(top.uploadRate)}).\n\nTotal network throughput across all **${summary.activeSocketsCount} active sockets** is **${formatBytesPerSec(summary.totalDownloadRate + summary.totalUploadRate)}**.`;
      }
      return `Current network bandwidth throughput is **${formatBytesPerSec(summary.totalDownloadRate + summary.totalUploadRate)}**.`;
    }

    // 2. Active AI Agents Questions
    if (q.includes('ai agent') || q.includes('ai') || q.includes('ollama') || q.includes('claude')) {
      if (summary.activeAiAgents.length === 0) {
        return `There are currently **no active AI agents or local LLMs** running on your system. Total active background sockets: ${summary.activeSocketsCount}.`;
      }
      return `There are currently **${summary.activeAiAgents.length} active AI agents** observed:\n\n${summary.activeAiAgents.map((a: string) => `* **${a}**`).join('\n')}\n\nLive AI-related network flow is currently accounted for in the AI Intelligence dashboard.`;
    }

    // 3. Traffic increase / why did traffic change
    if (q.includes('increase') || q.includes('sudden') || q.includes('change') || q.includes('why')) {
      if (summary.behaviorIndicatorsCount > 0) {
        return `Your network throughput recently observed a variation compared to historical baselines. Top process is **${summary.topProcesses[0]?.name || 'system'}** with current throughput of **${formatBytesPerSec(summary.totalDownloadRate + summary.totalUploadRate)}**. Check the Behavior Indicators panel for specific baseline comparisons.`;
      }
      return `Network throughput is currently **${formatBytesPerSec(summary.totalDownloadRate + summary.totalUploadRate)}** across **${summary.activeSocketsCount} open sockets**. All observed processes are operating within standard historical baselines.`;
    }

    // Default general summary
    return `Current network status:\n* **Active Sockets:** ${summary.activeSocketsCount}\n* **Throughput:** ↓ ${formatBytesPerSec(summary.totalDownloadRate)} | ↑ ${formatBytesPerSec(summary.totalUploadRate)}\n* **Active AI Agents:** ${summary.activeAiAgents.length > 0 ? summary.activeAiAgents.join(', ') : 'None'}\n* **Top Bandwidth Consumer:** ${summary.topProcesses[0] ? `${summary.topProcesses[0].name} (PID ${summary.topProcesses[0].pid})` : 'Idle'}`;
  }

  /**
   * Extracts interactive UI action chips from query and answer.
   */
  private extractActionSuggestions(
    query: string,
    text: string,
    summary: AnalystContextSummary
  ): AnalystActionSuggestion[] {
    const suggestions: AnalystActionSuggestion[] = [];
    const combined = `${query} ${text}`.toLowerCase();

    if (combined.includes('ollama')) {
      suggestions.push({
        label: 'View Ollama Activity',
        actionType: 'view_agent',
        target: 'ollama',
      });
    }

    if (combined.includes('claude')) {
      suggestions.push({
        label: 'View Claude Code Activity',
        actionType: 'view_agent',
        target: 'claude-code',
      });
    }

    if (summary.topProcesses.length > 0 && summary.topProcesses[0]) {
      const top = summary.topProcesses[0];
      suggestions.push({
        label: `Inspect ${top.name} (PID ${top.pid})`,
        actionType: 'view_process',
        target: String(top.pid),
      });
    }

    suggestions.push({
      label: 'Open Investigation Workspace',
      actionType: 'open_investigation',
      target: 'default',
    });

    return suggestions.slice(0, 3);
  }
}

export const localAiAnalystService = new LocalAiAnalystService();
