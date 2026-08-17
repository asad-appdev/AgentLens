export interface RawProcessTrafficRecord {
  pid: number;
  processName: string;
  bytesIn: number;
  bytesOut: number;
  timestamp: string;
}

export interface NettopParseResult {
  records: RawProcessTrafficRecord[];
  totalParsed: number;
  skippedLines: number;
  errors: Array<{ lineIndex: number; line: string; reason: string }>;
}

export class NettopParser {
  /**
   * Parses machine-readable CSV output from `nettop -P -n -x`
   * Format:
   * time,,interface,state,bytes_in,bytes_out,rx_dupe,rx_ooo,re-tx,rtt_avg,rcvsize,tx_win,tc_class,tc_mgt,cc_algo,P,C,R,W,arch,
   * 01:01:46.872352,launchd.1,,,0,0,0,0,0,,,,,,,,,,,,
   * 01:01:46.872376,Slack Helper.5034,,,108093,67721,2720,1288,2721,,,,,,,,,,,,
   */
  public parse(rawOutput: string, defaultTimestamp: string = new Date().toISOString()): NettopParseResult {
    const records: RawProcessTrafficRecord[] = [];
    const errors: Array<{ lineIndex: number; line: string; reason: string }> = [];
    let skippedLines = 0;

    if (!rawOutput || rawOutput.trim().length === 0) {
      return { records: [], totalParsed: 0, skippedLines: 0, errors: [] };
    }

    const lines = rawOutput.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line) {
        skippedLines++;
        continue;
      }

      // Skip CSV header line
      if (line.startsWith('time,') || line.includes('bytes_in,bytes_out')) {
        skippedLines++;
        continue;
      }

      try {
        const record = this.parseLine(line, defaultTimestamp);
        if (record) {
          records.push(record);
        } else {
          skippedLines++;
        }
      } catch (err: unknown) {
        skippedLines++;
        errors.push({
          lineIndex: i + 1,
          line,
          reason: err instanceof Error ? err.message : 'Failed to parse nettop CSV line',
        });
      }
    }

    return {
      records,
      totalParsed: records.length,
      skippedLines,
      errors,
    };
  }

  /**
   * Parses a single CSV line from nettop.
   */
  public parseLine(line: string, defaultTimestamp: string = new Date().toISOString()): RawProcessTrafficRecord | null {
    const parts = line.split(',');
    if (parts.length < 6) {
      throw new Error(`Insufficient CSV columns (${parts.length} < 6)`);
    }

    const timeCol = parts[0]?.trim() || '';
    const procCol = parts[1]?.trim() || '';
    const bytesInStr = parts[4]?.trim() || '0';
    const bytesOutStr = parts[5]?.trim() || '0';

    if (!procCol) {
      return null;
    }

    // Process column is formatted as "[processName].[PID]"
    // e.g. "Slack Helper.5034", "node.54572", "com.docker.backend.12291"
    const lastDotIdx = procCol.lastIndexOf('.');
    if (lastDotIdx === -1) {
      throw new Error(`Process identifier missing PID separator dot: "${procCol}"`);
    }

    const processName = procCol.slice(0, lastDotIdx).trim();
    const pidStr = procCol.slice(lastDotIdx + 1).trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid) || pid <= 0) {
      throw new Error(`Invalid process PID extracted from "${procCol}": "${pidStr}"`);
    }

    const bytesIn = parseInt(bytesInStr, 10);
    const bytesOut = parseInt(bytesOutStr, 10);

    if (isNaN(bytesIn) || isNaN(bytesOut)) {
      throw new Error(`Invalid byte counters: bytesIn="${bytesInStr}", bytesOut="${bytesOutStr}"`);
    }

    return {
      pid,
      processName: processName || `PID-${pid}`,
      bytesIn: Math.max(0, bytesIn),
      bytesOut: Math.max(0, bytesOut),
      timestamp: timeCol || defaultTimestamp,
    };
  }
}

export const nettopParser = new NettopParser();
