import { NetworkConnection } from '@network-monitor/shared';
import { CommandRunnerService, commandRunner } from './command-runner.service.js';
import { LsofParser, lsofParser, ParseResult } from './lsof-parser.service.js';

export interface DiscoveryOptions {
  discoveredAt?: string;
}

export class LsofService {
  private readonly runner: CommandRunnerService;
  private readonly parser: LsofParser;

  constructor(runner: CommandRunnerService = commandRunner, parser: LsofParser = lsofParser) {
    this.runner = runner;
    this.parser = parser;
  }

  /**
   * Executes `lsof -i -P -n` and parses the output into strongly-typed NetworkConnection objects.
   */
  public async discoverConnections(options: DiscoveryOptions = {}): Promise<NetworkConnection[]> {
    const startMs = Date.now();
    const discoveredAt = options.discoveredAt || new Date().toISOString();

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[LsofService] Initiating network connection discovery via 'lsof -i -P -n'...`);
    }

    // Strictly fixed binary and arguments - NEVER constructed from user input or shell interpolation
    const result = await this.runner.execute('lsof', ['-i', '-P', '-n']);

    // Note: lsof returns exitCode 1 when no matching network connections are found
    if (result.exitCode !== 0 && (!result.stdout || result.stdout.trim().length === 0)) {
      if (result.stderr && result.stderr.toLowerCase().includes('permission denied')) {
        console.warn(`[LsofService] Permission warning from lsof: ${result.stderr.trim()}`);
      } else if (process.env.NODE_ENV !== 'test') {
        console.log(`[LsofService] lsof exited with code ${result.exitCode} (no open sockets detected or non-fatal notice).`);
      }
      return [];
    }

    const parseResult: ParseResult = this.parser.parse(result.stdout, discoveredAt);
    const durationMs = Date.now() - startMs;

    if (process.env.NODE_ENV !== 'test') {
      console.log(
        `[LsofService] Discovery completed in ${durationMs}ms: ` +
        `${parseResult.totalParsed} connections parsed, ` +
        `${parseResult.skippedLines} lines skipped/headers, ` +
        `${parseResult.errors.length} warnings/malformed lines.`
      );
    }

    if (parseResult.errors.length > 0 && process.env.NODE_ENV === 'development') {
      parseResult.errors.slice(0, 5).forEach((err) => {
        console.warn(`[LsofService] Line ${err.lineIndex} skipped: ${err.reason} -> "${err.line}"`);
      });
    }

    return parseResult.connections;
  }
}

export const lsofService = new LsofService();
