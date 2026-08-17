import type { RawProcessInfo } from '../../interfaces/process-provider.interface.js';

import { safeParsePowerShellJson } from './powershell-json.parser.js';

export interface Win32ProcessRecord {
  ProcessId?: number | string;
  ParentProcessId?: number | string;
  Name?: string;
  ExecutablePath?: string;
  CommandLine?: string;
}

/**
 * Parses PowerShell `Get-CimInstance Win32_Process` JSON output into normalized `RawProcessInfo[]`.
 */
export function parseWin32ProcessesJson(stdout: string): RawProcessInfo[] {
  const records = safeParsePowerShellJson<Win32ProcessRecord>(stdout);
  const list: RawProcessInfo[] = [];

  for (const rec of records) {
    if (!rec) continue;

    const pid = parseInt(String(rec.ProcessId || '0'), 10);
    const ppid = parseInt(String(rec.ParentProcessId || '0'), 10);
    const comm = rec.Name || `PID ${pid}`;
    const args = rec.CommandLine || comm;
    const executablePath = rec.ExecutablePath || comm;

    if (pid >= 0) {
      list.push({
        pid,
        ppid: isNaN(ppid) ? 0 : ppid,
        comm,
        args,
        executablePath,
      });
    }
  }

  return list;
}

/**
 * Parses `tasklist /FO CSV /V` fallback output.
 */
export function parseWindowsTasklistCsv(stdout: string): RawProcessInfo[] {
  if (!stdout) return [];
  const lines = stdout.split('\n');
  const list: RawProcessInfo[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    // Split CSV columns handling quotes
    const cols = line.split('","').map((c) => c.replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    const name = cols[0] || 'unknown';
    const pid = parseInt(cols[1] || '0', 10);

    if (!isNaN(pid) && pid >= 0) {
      list.push({
        pid,
        ppid: 0,
        comm: name,
        args: name,
        executablePath: name,
      });
    }
  }

  return list;
}
