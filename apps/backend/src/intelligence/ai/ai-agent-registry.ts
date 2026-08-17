import { AiAgentDefinition } from '@network-monitor/shared';

export const BUILTIN_AI_AGENTS: AiAgentDefinition[] = [
  {
    id: 'ollama',
    displayName: 'Ollama',
    category: 'local-runtime',
    processNames: ['ollama', 'ollama.exe', 'ollama_llama_server', 'ollama_llama_server.exe'],
    executableNames: ['ollama', 'ollama.exe', 'ollama_llama_server', 'ollama_llama_server.exe'],
    commandPatterns: ['ollama serve', 'ollama run', 'ollama.exe'],
    knownPorts: [11434],
    description: 'Local large language model server and runtime.',
  },
  {
    id: 'lm-studio',
    displayName: 'LM Studio',
    category: 'local-runtime',
    processNames: ['lmstudio', 'lmstudio.exe', 'lms', 'lms.exe', 'lm studio', 'LM Studio.exe'],
    executableNames: ['LM Studio', 'LM Studio.exe', 'lms', 'lms.exe'],
    commandPatterns: ['lms server', 'LM Studio', 'lmstudio.exe'],
    knownPorts: [1234],
    description: 'Desktop application for running local LLMs on macOS and Windows.',
  },
  {
    id: 'claude-code',
    displayName: 'Claude Code',
    category: 'cli-agent',
    processNames: ['claude', 'claude.exe', 'claude-code', 'claude.cmd'],
    executableNames: ['claude', 'claude.exe', 'claude.cmd'],
    commandPatterns: ['claude', 'claude-code', 'claude.exe', 'claude.cmd'],
    knownPorts: [],
    description: 'Anthropic research CLI coding agent for terminal workflows.',
  },
  {
    id: 'codex-cli',
    displayName: 'Codex CLI',
    category: 'cli-agent',
    processNames: ['codex', 'codex.exe', 'codex-cli', 'codex.cmd'],
    executableNames: ['codex', 'codex.exe', 'codex.cmd'],
    commandPatterns: ['codex', 'codex.exe', 'codex.cmd'],
    knownPorts: [],
    description: 'CLI code generation and assistance agent.',
  },
  {
    id: 'gemini-cli',
    displayName: 'Gemini CLI',
    category: 'cli-agent',
    processNames: ['gemini', 'gemini.exe', 'gemini-cli', 'gemini.cmd'],
    executableNames: ['gemini', 'gemini.exe', 'gemini.cmd'],
    commandPatterns: ['gemini', 'gemini.exe', 'gemini.cmd'],
    knownPorts: [],
    description: 'Google Gemini developer CLI assistant.',
  },
  {
    id: 'openclaw',
    displayName: 'OpenClaw',
    category: 'cli-agent',
    processNames: ['openclaw', 'openclaw.exe', 'claw', 'claw.exe'],
    executableNames: ['openclaw', 'openclaw.exe'],
    commandPatterns: ['openclaw', 'openclaw.exe'],
    knownPorts: [],
    description: 'Autonomous local coding agent.',
  },
  {
    id: 'continue',
    displayName: 'Continue',
    category: 'ide-assistant',
    processNames: ['continue-core', 'continue-core.exe', 'continue-server', 'continue'],
    executableNames: ['continue-core', 'continue-core.exe'],
    commandPatterns: ['continue-core', 'continue', 'continue-core.exe'],
    knownPorts: [65433],
    description: 'Open-source AI code assistant extension server.',
  },
  {
    id: 'aider',
    displayName: 'Aider',
    category: 'cli-agent',
    processNames: ['aider', 'aider.exe'],
    executableNames: ['aider', 'aider.exe'],
    commandPatterns: ['aider', 'python -m aider', 'aider.exe', 'python.exe -m aider'],
    knownPorts: [],
    description: 'AI pair programming in your terminal.',
  },
  {
    id: 'antigravity',
    displayName: 'Google Antigravity',
    category: 'ide-assistant',
    processNames: [
      'Antigravity IDE',
      'Antigravity IDE Helper',
      'Antigravity IDE Helper (Plugin)',
      'Antigravity IDE Helper (Renderer)',
      'Antigravity IDE Helper (GPU)',
      'Antigravi',
      'antigravity',
      'antigravity.exe',
      'Antigravity.exe',
      'Antigravity IDE.exe',
      'language_server_macos_arm',
      'language_server_macos_x64',
      'language_server_linux_x64',
      'language_server_windows_x64.exe',
      'language_server',
      'language_',
      'agy',
      'agy.exe',
    ],
    executableNames: [
      'Antigravity IDE',
      'Antigravity IDE Helper',
      'Antigravity IDE.exe',
      'Antigravity.exe',
      'language_server_macos_arm',
      'language_server_macos_x64',
      'language_server_linux_x64',
      'language_server_windows_x64.exe',
      'language_server',
      'agy',
      'agy.exe',
    ],
    commandPatterns: [
      'Antigravity IDE',
      'antigravity',
      'language_server',
      'antigravity-ide',
      'agy',
      'cloudcode-pa.googleapis.com',
      'daily-cloudcode-pa.googleapis.com',
    ],
    knownPorts: [56432, 56433, 56443, 56444, 62432, 62433, 62434, 62442],
    description: 'Google Antigravity Advanced Agentic AI IDE and language server.',
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    category: 'ide-assistant',
    processNames: ['Cursor', 'Cursor.exe', 'Cursor Helper', 'Cursor Helper (Plugin)', 'Cursor Helper (Renderer)', 'cursor'],
    executableNames: ['Cursor', 'Cursor.exe', 'cursor'],
    commandPatterns: ['Cursor.app', 'cursor', 'Cursor.exe'],
    knownPorts: [],
    description: 'AI-first code editor and assistant.',
  },
  {
    id: 'windsurf',
    displayName: 'Windsurf',
    category: 'ide-assistant',
    processNames: ['Windsurf', 'Windsurf.exe', 'Windsurf Helper', 'windsurf'],
    executableNames: ['Windsurf', 'Windsurf.exe', 'windsurf'],
    commandPatterns: ['Windsurf.app', 'windsurf', 'Windsurf.exe'],
    knownPorts: [],
    description: 'Codeium Windsurf AI IDE with Cascade flow.',
  },
  {
    id: 'github-copilot',
    displayName: 'GitHub Copilot',
    category: 'ide-assistant',
    processNames: ['copilot-agent', 'copilot-language-server', 'github-copilot'],
    executableNames: ['copilot-agent', 'copilot-language-server'],
    commandPatterns: ['copilot-agent', 'copilot-language-server', 'github.copilot'],
    knownPorts: [],
    description: 'GitHub Copilot language server and editor extension.',
  },
  {
    id: 'open-webui',
    displayName: 'Open WebUI',
    category: 'web-ui',
    processNames: ['open-webui', 'open-webui.exe', 'open_webui'],
    executableNames: ['open-webui', 'open-webui.exe'],
    commandPatterns: ['open-webui serve', 'open-webui.exe', 'open_webui'],
    knownPorts: [8080],
    description: 'Self-hosted AI chat interface and LLM orchestrator.',
  },
  {
    id: 'localai',
    displayName: 'LocalAI',
    category: 'local-runtime',
    processNames: ['local-ai', 'local-ai.exe', 'localai', 'localai.exe'],
    executableNames: ['local-ai', 'local-ai.exe', 'localai', 'localai.exe'],
    commandPatterns: ['local-ai', 'local-ai.exe'],
    knownPorts: [8080],
    description: 'Self-hosted, drop-in replacement REST API for AI models.',
  },
  {
    id: 'anythingllm',
    displayName: 'AnythingLLM',
    category: 'web-ui',
    processNames: ['anythingllm', 'anythingllm.exe', 'anything-llm'],
    executableNames: ['AnythingLLM', 'AnythingLLM.exe'],
    commandPatterns: ['anythingllm', 'AnythingLLM.exe'],
    knownPorts: [3001],
    description: 'All-in-one desktop AI assistant with document vector search.',
  },
  {
    id: 'vllm',
    displayName: 'vLLM',
    category: 'local-runtime',
    processNames: ['vllm', 'vllm.exe', 'python3 -m vllm', 'python.exe -m vllm'],
    executableNames: ['vllm', 'vllm.exe'],
    commandPatterns: ['vllm.entrypoints', 'vllm serve', 'vllm.exe'],
    knownPorts: [8000],
    description: 'High-throughput and memory-efficient LLM serving engine.',
  },
  {
    id: 'llama-cpp',
    displayName: 'llama.cpp',
    category: 'local-runtime',
    processNames: ['llama-server', 'llama-server.exe', 'llama-cli', 'llama-cli.exe', 'llama-bench', 'main'],
    executableNames: ['llama-server', 'llama-server.exe', 'llama-cli', 'llama-cli.exe'],
    commandPatterns: ['llama-server', 'llama-server.exe', 'llama-cli'],
    knownPorts: [8080],
    description: 'Port of Facebook LLaMA model in pure C/C++.',
  },
];

export class AiAgentRegistry {
  private readonly registry = new Map<string, AiAgentDefinition>();

  constructor() {
    for (const agent of BUILTIN_AI_AGENTS) {
      this.registry.set(agent.id, agent);
    }
  }

  public getAll(): AiAgentDefinition[] {
    return Array.from(this.registry.values());
  }

  public getById(id: string): AiAgentDefinition | undefined {
    return this.registry.get(id);
  }

  public registerCustom(def: AiAgentDefinition): void {
    this.registry.set(def.id, def);
  }

  /**
   * Matches a process name, command line, executable path, and port against the registry.
   */
  public matchProcess(
    processName: string,
    commandLine?: string,
    localPorts: number[] = [],
    executablePath?: string
  ): { agent: AiAgentDefinition; sources: ('process-name' | 'executable' | 'command-pattern' | 'known-port')[]; evidence: string[] } | null {
    const procLower = processName.toLowerCase();
    const cmdLower = (commandLine || '').toLowerCase();
    const exeLower = (executablePath || '').toLowerCase();

    for (const agent of this.registry.values()) {
      const sources: ('process-name' | 'executable' | 'command-pattern' | 'known-port')[] = [];
      const evidence: string[] = [];

      // 1. Check exact or distinct process names
      const matchedProc = agent.processNames.find(
        (pn) => procLower === pn.toLowerCase() || (procLower.includes(pn.toLowerCase()) && !['node', 'python', 'sh', 'bash'].includes(procLower))
      );
      if (matchedProc) {
        sources.push('process-name');
        evidence.push(`Matched process name '${processName}' against signature '${matchedProc}'`);
      }

      // 2. Check executable paths / names
      if (agent.executableNames) {
        const matchedExe = agent.executableNames.find(
          (ex) => exeLower.includes(ex.toLowerCase()) || procLower === ex.toLowerCase() || procLower.replace(/\.exe$/, '') === ex.toLowerCase()
        );
        if (matchedExe && !sources.includes('process-name')) {
          sources.push('executable');
          evidence.push(`Matched executable binary/path against signature '${matchedExe}'`);
        }
      }

      // 3. Check command line pattern
      if (agent.commandPatterns && cmdLower) {
        const matchedPattern = agent.commandPatterns.find((pattern) => cmdLower.includes(pattern.toLowerCase()));
        if (matchedPattern) {
          sources.push('command-pattern');
          evidence.push(`Command line matches signature pattern '${matchedPattern}'`);
        }
      }

      // 4. Check known listening ports
      if (agent.knownPorts && agent.knownPorts.length > 0) {
        const matchedPort = localPorts.find((port) => agent.knownPorts!.includes(port));
        if (matchedPort) {
          sources.push('known-port');
          evidence.push(`Listening on known ${agent.displayName} service port ${matchedPort}`);
        }
      }

      if (sources.length > 0) {
        return { agent, sources, evidence };
      }
    }

    return null;
  }
}


export const aiAgentRegistry = new AiAgentRegistry();
