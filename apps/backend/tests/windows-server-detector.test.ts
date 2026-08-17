import { describe, it, expect } from 'vitest';
import { WindowsServerDetector } from '../src/platform/windows/windows-server-detector.provider.js';
import { WindowsNetworkProvider } from '../src/platform/windows/windows-network.provider.js';
import { WindowsProcessProvider } from '../src/platform/windows/windows-process.provider.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Windows Server Detector Unit Tests', () => {
  it('should correctly classify common Windows dev server runtimes and frameworks', () => {
    const mockRunner = new CommandRunnerService(true);
    const procProvider = new WindowsProcessProvider(mockRunner);
    const netProvider = new WindowsNetworkProvider(mockRunner, procProvider);
    const detector = new WindowsServerDetector(netProvider, procProvider);

    // Vite
    const viteRes = detector.classifyServerType('node.exe', 'node.exe C:\\app\\node_modules\\vite\\bin\\vite.js', 5173);
    expect(viteRes.serverType).toBe('Vite');
    expect(viteRes.isDevServer).toBe(true);
    expect(viteRes.confidence).toBe('HIGH');

    // Next.js
    const nextRes = detector.classifyServerType('node.exe', 'node.exe next dev', 3000);
    expect(nextRes.serverType).toBe('Next.js');
    expect(nextRes.isDevServer).toBe(true);

    // .NET Server
    const dotnetRes = detector.classifyServerType('dotnet.exe', 'dotnet.exe watch run', 5000);
    expect(dotnetRes.isDevServer).toBe(true);

    // Python FastAPI / Uvicorn
    const fastApiRes = detector.classifyServerType('python.exe', 'uvicorn main:app --reload', 8000);
    expect(fastApiRes.serverType).toBe('Python / FastAPI');
    expect(fastApiRes.isDevServer).toBe(true);

    // Ollama
    const ollamaRes = detector.classifyServerType('ollama.exe', 'ollama.exe serve', 11434);
    expect(ollamaRes.serverType).toBe('Ollama');
    expect(ollamaRes.isDevServer).toBe(false);
  });

  it('should reject killPort for inactive or invalid ports safely', async () => {
    const mockRunner = new CommandRunnerService(true);
    const procProvider = new WindowsProcessProvider(mockRunner);
    const netProvider = new WindowsNetworkProvider(mockRunner, procProvider);
    const detector = new WindowsServerDetector(netProvider, procProvider);

    const result = await detector.killPort({ port: 99999 });
    expect(result.success).toBe(false);
    expect(result.portReleased).toBe(true);
  });
});
