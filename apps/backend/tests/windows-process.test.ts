import { describe, it, expect } from 'vitest';
import {
  parseWin32ProcessesJson,
  parseWindowsTasklistCsv,
} from '../src/platform/windows/parsers/windows-process.parser.js';
import { WindowsProcessProvider } from '../src/platform/windows/windows-process.provider.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Windows Process Parser & Provider Unit Tests', () => {
  it('should parse Win32_Process JSON into RawProcessInfo records', () => {
    const jsonFixture = JSON.stringify([
      {
        ProcessId: 48231,
        ParentProcessId: 1000,
        Name: 'node.exe',
        ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe',
        CommandLine: '"C:\\Program Files\\nodejs\\node.exe" server.js',
      },
      {
        ProcessId: 4218,
        ParentProcessId: 1,
        Name: 'ollama.exe',
        ExecutablePath: 'C:\\Users\\User\\AppData\\Local\\Programs\\Ollama\\ollama.exe',
        CommandLine: 'ollama.exe serve',
      },
    ]);

    const list = parseWin32ProcessesJson(jsonFixture);
    expect(list).toHaveLength(2);
    expect(list[0]!.pid).toBe(48231);
    expect(list[0]!.ppid).toBe(1000);
    expect(list[0]!.comm).toBe('node.exe');
    expect(list[0]!.args).toContain('server.js');
    expect(list[0]!.executablePath).toBe('C:\\Program Files\\nodejs\\node.exe');

    expect(list[1]!.pid).toBe(4218);
    expect(list[1]!.comm).toBe('ollama.exe');
  });

  it('should parse tasklist CSV fallback', () => {
    const csvFixture = `
"Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title"
"System Idle Process","0","Services","0","8 K","Unknown","NT AUTHORITY\\SYSTEM","0:00:00","N/A"
"System","4","Services","0","156 K","Unknown","NT AUTHORITY\\SYSTEM","0:00:00","N/A"
"node.exe","48231","Console","1","45,120 K","Running","DESKTOP-ABC\\User","0:01:23","N/A"
`;

    const list = parseWindowsTasklistCsv(csvFixture);
    expect(list.length).toBeGreaterThanOrEqual(3);
    expect(list.some((p) => p.pid === 48231 && p.comm === 'node.exe')).toBe(true);
  });

  it('should reject termination of core Windows system processes (PID <= 4)', async () => {
    const mockRunner = new CommandRunnerService(true);
    const provider = new WindowsProcessProvider(mockRunner);

    const resPid0 = await provider.terminateProcess(0);
    expect(resPid0.success).toBe(false);
    expect(resPid0.errorCode).toBe('PROTECTED_PROCESS');

    const resPid4 = await provider.terminateProcess(4);
    expect(resPid4.success).toBe(false);
    expect(resPid4.errorCode).toBe('PROTECTED_PROCESS');
  });

  it('should support dry run termination', async () => {
    const mockRunner = new CommandRunnerService(true);
    const provider = new WindowsProcessProvider(mockRunner);

    const result = await provider.terminateProcess(48231, 'SIGTERM', true);
    expect(result.success).toBe(true);
    expect(result.message).toContain('[Dry Run]');
  });
});
